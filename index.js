// import environmental variables from ./.env in production mode
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// import NodeMailer
const nodemailer = require('nodemailer');

//import ibmiotf
const client = require("ibmiotf");

// import mongoDB
const { MongoClient } = require("mongodb");

// Database Connection URL
const url = process.env.DBURL;
const dbClient = new MongoClient(url);
// Database Name
const dbName = process.env.DBNAME;
// Database Collection Name
const dbCollection = process.env.DBCOLLECTION;


// Connect to Database
let collection
dbClient.connect(err => {
  if(err){
    console.error("ERROR_MONGODB: ", err)
  }
  else {
    console.log("CONNECTED_MONGODB")

    const db = dbClient.db(dbName)
    collection = db.collection(dbCollection)
  }
})



// configurate iotf Connection
const applicationConfig = {
  org: process.env.ORG,
  id: process.env.APPLICATIONID,
  domain: process.env.DOMAIN,
  "auth-key": process.env.APIKEY,
  "auth-token": process.env.APIAUTHTOKEN,
};

const appClient = new client.IotfApplication(applicationConfig);

// Connect application with IoT Cloud
appClient.connect();


// Connection Listener
appClient.on("connect", function () {
  console.log("CONNECTED_IBMIOTF");

  appClient.subscribeToDeviceEvents();
});


// Message Listener
appClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {
    console.log("DEVICE: " + deviceId + "    -    EVENT: " + eventType + "    -    PAYLOAD: " + payload);

    // Insert Data in Dataabase
    saveData(JSON.parse(payload).data)

    //send E-Mail notification if weight exceeds max
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    // get all entrys of current month
    const monthOption1 = new Date(currentYear,currentMonth,0,0,0,0)
    const monthOption2 = new Date(currentYear, currentMonth, 31, 23, 59, 59)
    collection
      .find({ createdAt: { $gte: monthOption1, $lt: monthOption2 } })
      .toArray()
      .then((dbres)=>{
        let weight = 0;
        for(let i = 0; i < dbres.length; i++){
          weight = weight + dbres[i].weight
        }
        // if weight exceeds limit
        if(weight > process.env.MONTHLIMIT){
          console.log('Reached month limit')
          sendEmail('Monatslimit erreicht', 'month')
        }
      })
    // get all entrys of current year
    const yearOption1 = new Date(currentYear,0,0,0,0,0)
    const yearOption2 = new Date(currentYear, 11, 31, 23, 59, 59)
    collection
      .find({ createdAt: { $gte: yearOption1, $lt: yearOption2 } })
      .toArray()
      .then((dbres)=>{
        let weight = 0;
        for(let i = 0; i < dbres.length; i++){
          weight = weight + dbres[i].weight
        }
        // if weight exceeds limit
        if(weight > process.env.YEARLIMIT){
          console.log('Reached year limit')
          sendEmail('Jahreslimit erreicht', 'year')
        }
      })
    
  }
);

// Error Listener
appClient.on("error", function (err) {
  console.error("ERROR_IBMIOTF: " + err);
});





// functions--------------------------------------------------------------------------------------------------
function sendEmail(subject, topic) {

  // mail server config
  const transporter = nodemailer.createTransport({
    host: 'mail.gmx.net',
    port: 465,
    service: 'gmx',
    auth: {
      user: process.env.EMAILUSER,
      pass: process.env.EMAILPASSWORD
    }
  })

  // msg config
  let mailOptions = {
    from: process.env.EMAILUSER,
    to: process.env.EMAILRECEIVER,
    subject: subject,
    html: undefined
  }

  if(topic === 'month'){
    mailOptions.html = '<h1 stlyle="font-family: Segoe UI">Monatliches Limit überschritten</h1><h3 stlyle="font-family: Segoe UI">Tipps zur Müllreduzierung:</h3><ul stlyle="font-family: Segoe UI"><li>Stoffbeutel statt Plastiktüten</li><li>Keine Kaffeekapseln verwenden</li><li>Obst und Gemüse lose einkaufen</li><li>Eine große Packung statt vieler kleiner Packungen kaufen</li><li>Zahnbürsten aus Holz statt aus Plastik</li><li>Milch und Joghurt im Glas</li><li>Reparieren statt neu kaufen</li></ul>'
  }
  else {
    mailOptions.html = '<h1 stlyle="font-family: Segoe UI">Jährliches Limit überschritten</h1><h3 stlyle="font-family: Segoe UI">Tipps zur Müllreduzierung:</h3><ul stlyle="font-family: Segoe UI"><li>Stoffbeutel statt Plastiktüten</li><li>Keine Kaffeekapseln verwenden</li><li>Obst und Gemüse lose einkaufen</li><li>Eine große Packung statt vieler kleiner Packungen kaufen</li><li>Zahnbürsten aus Holz statt aus Plastik</li><li>Milch und Joghurt im Glas</li><li>Reparieren statt neu kaufen</li></ul>'
  }

  // send mail
  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.error("ERROR_EMAIL: ", error)
    }
    else {
      console.log("SEND_EMAIL: ", info.response)
    }
  })
}



// Insert Data in Database
function saveData(message) {
  message.createdAt = new Date();

  if (collection) {
    collection.insertOne(message, (err, res) => {
      if (err) {
        console.error("ERROR_DB: ", err);
      } else {
        console.log("INSERTED_DB")
      }
    });
  }
}