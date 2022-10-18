require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const cors = require('cors')
const KJUR = require('jsrsasign')
const jwt = require("jsonwebtoken")
const {
  default: axios
} = require('axios')

let jwtCredentials = {
  apiKey: process.env.apiKey,
  apiSecret: process.env.apiSecret
}

const app = express()
const port = process.env.PORT || 4000

app.use(bodyParser.json(), cors())
app.options('*', cors())

function createJWTToken() {
  const payload = {
    iss: jwtCredentials.apiKey,
    exp: ((new Date()).getTime() + 5000)
  };

  return jwt.sign(payload, jwtCredentials.apiSecret);
}

async function axiosHelper() {
  return axios.create({
    baseURL: 'https://api.zoom.us/v2/',
    headers: {
      'Authorization': 'Bearer ' + await createJWTToken(),
      'Content-Type': 'application/json'
    }
  });
}

app.post('/', (req, res) => {

  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2

  const oHeader = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const oPayload = {
    sdkKey: process.env.ZOOM_SDK_KEY,
    mn: req.body.meetingNumber,
    role: req.body.role,
    iat: iat,
    exp: exp,
    appKey: process.env.ZOOM_SDK_KEY,
    tokenExp: iat + 60 * 60 * 2
  }

  console.log(`Secret: ${process.env.ZOOM_SDK_SECRET}, Key: ${process.env.ZOOM_SDK_KEY}, Payload: ${JSON.stringify(req.body)}`);

  const sHeader = JSON.stringify(oHeader)
  const sPayload = JSON.stringify(oPayload)
  const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, process.env.ZOOM_SDK_SECRET)

  res.json({
    signature: signature
  })
});

app.post('/registration', async (req, res) => {
  let apiEndpoint = `meetings/${req.body.meetingNumber}/registrants`;
  let request = await axiosHelper();

  try {
    const {
      data
    } = await request.post(apiEndpoint, JSON.stringify(req.body));

    return res.json(data)
  } catch (err) {

    if (err.response && err.response.data.code == '429') {
      const {
        data
      } = await request.get(`${apiEndpoint}?page_size=300&status=approved`);

      let registrantByEmail = data.registrants.find(registrant => registrant.email == req.body.email);

      return res.json(registrantByEmail ? registrantByEmail : {
        message: 'Something went wrong!'
      })
    }
  }

  return res.json({
    message: 'Something went wrong!'
  })
});

app.get('/', function (req, res) {
   res.sendFile(__dirname + '/demo.html');
});

app.listen(port, () => console.log(`Zoom Meeting SDK Sample Signature Node.js on port ${port}!`))
