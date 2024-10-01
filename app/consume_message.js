const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const photoModel = require('./photo_model');
const ZipStream = require('zip-stream');
const got = require('got');

const pubSubClient = new PubSub();
const storage = new Storage();
const bucketName = 'dmii2024bucket';
const jobStatus = {};
const subscriptionName = 'projects/dmii-2024/subscriptions/dmii2-7';
const subscription = pubSubClient.subscription(subscriptionName);

const messageHandler = async (message) => {
  console.log(`Message reçu ${message.id}:`);
  console.log(`\tDonnées: ${message.data}`);
  console.log(`\tAttributs: ${JSON.stringify(message.attributes)}`);

  message.ack();
  const data = JSON.parse(message.data);
  const tags = data.tags;

  try {
    const photos = await photoModel.getFlickrPhotos(tags, 'any');
    const topPhotos = photos.slice(0, 10);
    const publicUrl = await createAndUploadZip(topPhotos, tags);

    console.log(`Zip uploadé : ${publicUrl}`);

    jobStatus[tags] = {
      status: 'success',
      url: publicUrl
    };
  } catch (error) {
    console.error(`Erreur message : ${error.message}`);

    jobStatus[tags] = {
      status: 'error',
      error: error.message
    };
  }
};

async function generateSignedUrl(fileName) {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // L'URL expirera dans 15 minutes
  };

  const [url] = await storage
    .bucket(bucketName)
    .file(fileName)
    .getSignedUrl(options);

  return url;
}


async function createAndUploadZip(photos, tags) {
  return new Promise((resolve, reject) => {
    const zip = new ZipStream();

    const zipFileName = `photos_${encodeURIComponent(tags)}.zip`;
    const file = storage.bucket(bucketName).file(zipFileName);
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'application/zip',
        cacheControl: 'private'
      },
      resumable: false
    });

    stream.on('error', (err) => {
      reject(err);
    });

    stream.on('finish', async () => {
      try {
        const publicUrl = await generateSignedUrl(zipFileName);
        resolve(publicUrl);
      } catch (error) {
        reject(error);
      }
    });

    zip.pipe(stream);

    const queue = photos.map((photo, index) => ({
      name: `photo_${index}.jpg`,
      url: photo.media.m
    }));

    function addNextFile() {
      if (queue.length === 0) {
        zip.finalize();
        return;
      }

      const { name, url } = queue.shift();
      const imageStream = got.stream(url);

      imageStream.on('error', (err) => {
        reject(err);
      });

      zip.entry(imageStream, { name }, (err) => {
        if (err) {
          reject(err);
        } else {
          addNextFile();
        }
      });
    }
    addNextFile();
  });
}

subscription.on('message', messageHandler);

subscription.on('error', (error) => {
  console.error(`Erreur de souscription : ${error.message}`);
});


module.exports = {
  jobStatus
};
