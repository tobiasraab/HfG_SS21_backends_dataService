/* 
  Author: Tobias Raab

  Used Libraries:
  ibmiotf 0.2.41 https://www.npmjs.com/package/ibmiotf
  mongodb 4.3.0 https://www.npmjs.com/package/mongodb
  nodemailer 6.7.2 https://www.npmjs.com/package/nodemailer
  dotenv: 10.0.0 https://www.npmjs.com/package/dotenv
*/


// import environmental variables from ./.env in production mode
// copy content of env.txt in a new file called .env and insert variable_values to make the program work localy
// if you deploy it on a container set your environmental variables in the configuration of the container
// environmental Variables are accessed through process.env.<VARIABLENAME>
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// import libraries
const nodemailer = require('nodemailer');
const client = require("ibmiotf");
const { MongoClient } = require("mongodb");



// Database Connection URL
const url = process.env.DBURL;
const dbClient = new MongoClient(url);
// Database Name
const dbName = process.env.DBNAME;
// Database Collection Name
const dbCollection = process.env.DBCOLLECTION;

// Connect to MongoDB database
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



// configurate ibmiotf Connection
const applicationConfig = {
  org: process.env.ORG, // IBM IoT Plattform Organization ID
  id: process.env.APPLICATIONID, // set new ID for Application
  domain: process.env.DOMAIN, // DOMAIN = "internetofthings.ibmcloud.com"
  "auth-key": process.env.APIKEY, // Api Key: IBM Watson IoT Platform => Apps
  "auth-token": process.env.APIAUTHTOKEN, // Token for the API Key
};

// create new Application
const appClient = new client.IotfApplication(applicationConfig);

// Connect application with IoT Cloud
appClient.connect();


// Listen on Connection with IBM Watson IoT Platform
appClient.on("connect", function () {
  console.log("CONNECTED_IBMIOTF");

  appClient.subscribeToDeviceEvents();
});


// Listen for Device Events on the IBM Watson Iot Platform
appClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {
    console.log("INCOMING_EVENT:\nDEVICE: " + deviceId + "\nEVENT: " + eventType + "\nPAYLOAD: " + payload);

    // Insert Data in Dataabase
    saveData(JSON.parse(payload).data)



    //send E-Mail notification if trash exceeds weight limit for month or year
    // get current month and year
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()


    // set parameters for database search
    const monthOption1 = new Date(currentYear,currentMonth,0,0,0,0)
    const monthOption2 = new Date(currentYear, currentMonth, 31, 23, 59, 59)

    // get all entrys of current month
    collection
      .find({ createdAt: { $gte: monthOption1, $lt: monthOption2 } }) // gets alls entries of current month
      .toArray()
      .then((dbres)=>{
        // add all weights of current month together
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


    // set parameters for database search
    const yearOption1 = new Date(currentYear,0,0,0,0,0)
    const yearOption2 = new Date(currentYear, 11, 31, 23, 59, 59)

    // get all entrys of current year
    collection
      .find({ createdAt: { $gte: yearOption1, $lt: yearOption2 } }) // gets alls entries of current year
      .toArray()
      .then((dbres)=>{
        // add all weights of current year together
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
    host: 'mail.gmx.net', //SMTP Mail-Server (server data for GMX: https://hilfe.gmx.net/pop-imap/pop3/serverdaten.html#indexlink_help_pop-imap_pop3)
    port: 465, //SMTP Mail-Server Port
    service: 'gmx',
    auth: {
      user: process.env.EMAILUSER, // GMX User name
      pass: process.env.EMAILPASSWORD // GMX User Password
    }
  })

  // E-Mail msg config
  let mailOptions = {
    from: process.env.EMAILUSER, // GMX User name
    to: process.env.EMAILRECEIVER, // E-Mail receiver
    subject: subject, // E-Mail topic
    html: undefined // E-Mail content
  }

  // set right E-Mail content
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

  // Check if there is already a connection to the Database
  if (collection) {
    // Insert data in collection
    collection.insertOne(message, (err, res) => {
      if (err) {
        console.error("ERROR_DB: ", err);
      } else {
        console.log("INSERTED_DB")
      }
    });
  }
}