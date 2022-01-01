// import environmental variables from ./.env in production mode
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}




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
    console.log("ERROR_MONGODB: ", err)
  }
  else {
    console.log("CONNECTED_MONGODB")

    const db = dbClient.db(dbName)
    collection = db.collection(dbCollection)
  }
})


// Insert Data in Database
function saveData(message) {
  message.createdAt = new Date();

  if (collection) {
    collection.insertOne(message, (err, res) => {
      if (err) {
        console.log("ERROR_DB: ", err);
      } else {
        console.log("INSERTED_DB")
      }
    });
  }
}




//import ibmiotf
const client = require("ibmiotf");

// configurate Connection
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
  }
);

// Error Listener
appClient.on("error", function (err) {
  console.log("ERROR_IBMIOTF: " + err);
});