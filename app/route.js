const formValidator = require('./form_validator');
const photoModel = require('./photo_model');
const { PubSub } = require('@google-cloud/pubsub');
const { jobStatus } = require('./consume_message');




function route(app) {
  app.get('/', (req, res) => {
    const tags = req.query.tags;
    const tagmode = req.query.tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      invalidParameters: false,
      zipFileUrl: null
    };

    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }

    if (jobStatus[tags] && jobStatus[tags].status === 'success') {
      ejsLocalVariables.zipFileUrl = jobStatus[tags].url;
    }

    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
        return res.status(500).send({ error });
      });
  });


  app.post('/zip', async (req, res) => {
    const tags = req.query.tags;

    const pubSubClient = new PubSub();
    const topicName = 'projects/dmii-2024/topics/dmii2-7';

    const data = JSON.stringify({ tags });

    try {
      const messageId = await pubSubClient.topic(topicName).publishMessage({ data: Buffer.from(data) });
      console.log(`Message ${messageId} publié.`);
    } catch (error) {
      console.error(`Erreur : ${error.message}`);
      res.status(500).send(`Erreur : ${error.message}`);
    }
  });
}



module.exports = route;
