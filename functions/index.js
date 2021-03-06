const functions = require('firebase-functions');
//Use this to deploy functions
//firebase deploy --only functions

const admin = require('firebase-admin');
var request = require('request');
admin.initializeApp();

// Take the text parameter passed to this HTTP endpoint and insert it into the
// Realtime Database under the path /messages/:pushId/original
exports.addMessage = functions.https.onRequest((req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into the Realtime Database using the Firebase Admin SDK.
  return admin.database().ref('/messages').push({original: original}).then((snapshot) => {
    // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
    return res.redirect(303, snapshot.ref.toString());
  });
});

//make a notification whenever a new message is written to the db
exports.messageNotification = functions.firestore
	.document('users/{userId}/contacts/{contactId}/messages/{messageId}')
	.onCreate((snap, context) => {
//get the id of the sender and receiver, and the message text and id
		const receiverId = context.params.userId;
		console.log("receiverId: ", receiverId);

		const message = snap.data().text;

		const messageId = context.params.messageId;
		console.log("messageId: ", messageId);

		const senderId = snap.data().fromUserId;

		console.log("fromUserId: ", sender);

//dont send the notification to the user who sent the message
		if (sender.toString().replace(/\r?\n$/, '') === receiverId.toString().replace(/\r?\n$/, '')){
			console.log("no notification sent, as message from target");
		} else {
			//get the sender's name and the device token of the receiver (where to send the notification to)
          			const senderName = admin.firestore().collection('users').doc(senderId).getString('name');
          			console.log("senderName: ", senderName);

          			const receiverToken = admin.firestore().collection('users').doc(receiverId).getString('deviceToken');
          			console.log("token: ", token);

          			//we have everything we need
          			//Build the message payload and send the message
          			console.log("Build notification");
          			const payload = {
          				data: {
          					data_type: "notification",
          					title: "Text from " + senderName,
          					message: message,
          					message_id: messageId,
          				}
          			};
//send the notification to the receiver
          			return admin.messaging().sendToDevice(token, payload)

          	}
});

//Helper sub class for holding information
function returnData(imageURL, description, coord) {
    this.imageURL = imageURL;
    this.description = description;
    this.coord = coord;
}

//Generates a bearing between two locations
function  bearing(lat1,lng1,lat2,lng2) {
            var dLon = _toRad(lng2-lng1);
            var y = Math.sin(dLon) * Math.cos(_toRad(lat2));
            var x = Math.cos(_toRad(lat1))*Math.sin(_toRad(lat2)) - Math.sin(_toRad(lat1))*Math.cos(_toRad(lat2))*Math.cos(dLon);
            var brng = _toDeg(Math.atan2(y, x));
            return ((brng + 360) % 360);
}

function _toRad(deg) {
           return deg * Math.PI / 180;
      }

function _toDeg(rad) {
          return rad * 180 / Math.PI;
      }


//strip <b> tags from html
function strip(html)
      {
      html = html.replace(/<b>/g, "");
      html = html.replace(/<\/b>/g, "");
      html = html.replace(/<(?:.|\n)*?>/gm, "");
      return html;
      }

exports.mapRequest = functions.https.onRequest((req,res) => {
  //Process request
  var input = req.query.text;
  var split = input.split("---");

  var convertRoute = "https://maps.googleapis.com/maps/api/geocode/json?address=";
  var conFirst = convertRoute + split[0] + "&key=AIzaSyB48bubXS-1ArBemvhzNL0d6_7-hFvyivg";
  var conSecond = convertRoute + split[1]+ "&key=AIzaSyB48bubXS-1ArBemvhzNL0d6_7-hFvyivg";

  //Convert both requested locations to the closest match as per googles geocoding API
  request(conFirst, function(error, response, body) {
    var start = JSON.parse(body).results[0].formatted_address;
    request(conSecond, function(error, response, body){
      var end = JSON.parse(body).results[0].formatted_address;
      var routeURL = "https://maps.googleapis.com/maps/api/directions/json?origin=" + start + "&destination=" + end + "&mode=walking&key=AIzaSyB48bubXS-1ArBemvhzNL0d6_7-hFvyivg";
      //https://maps.googleapis.com/maps/api/directions/json?origin='228 Mott, New York, NY'&destination='102 St Marks Pl, New York, NY&mode=walking

      request(routeURL, function (error, response, body) {
        var ob = JSON.parse(body);
        var location_array = [ob.routes[0].legs[0].steps[0].start_location, ob.routes[0].legs[0].steps[0].end_location];
        var description_array = [strip(ob.routes[0].legs[0].steps[0].html_instructions)];
        var i;
      for (i = 1; i < ob.routes[0].legs[0].steps.length; i++) {
          location_array.push(ob.routes[0].legs[0].steps[i].end_location);
          description_array.push(strip(ob.routes[0].legs[0].steps[i].html_instructions));
      }
      var shot_array = [];
      var bearing_array = [];

      for(i=0; i < location_array.length-1; i++){
        var bear = bearing(location_array[i].lat, location_array[i].lng, location_array[i+1].lat, location_array[i+1].lng);
        bearing_array.push(bear);
      }

      //Generate return data
      var data = [];
      for(i=0; i<location_array.length; i++){
        var dataPoint;
        var streetURL;
        //Should point at the place
        if(i === location_array.length-1){
          //Show a streetview shot of the actual place
          streetURL = "https://maps.googleapis.com/maps/api/streetview?size=600x300&location=" + split[1] + "&key=AIzaSyB48bubXS-1ArBemvhzNL0d6_7-hFvyivg";
          dataPoint = new returnData(streetURL,"Welcome to your destination", location_array[i]);
          data.push(dataPoint);

        }
        else{
          streetURL = "https://maps.googleapis.com/maps/api/streetview?size=600x300&location=" +
          String(location_array[i].lat) + "," + String(location_array[i].lng) +
          "&heading=" + bearing_array[i] + "&pitch=-0.76" + "&key=AIzaSyB48bubXS-1ArBemvhzNL0d6_7-hFvyivg";
          dataPoint = new returnData(streetURL, description_array[i], location_array[i]);
          data.push(dataPoint);
        }
      }
      res.json(data);
        });
    });
  });
});


//Returns the entire database
exports.getWholeDatabase = functions.https.onRequest((req, res) => {
   // Grab the text parameter.
   const original = req.query.text;

   admin
      .database()
      .ref('/messages')
      .once('value',
          snap =>  res.json(snap.val()),
          err => res.json(err)
      )
})

//Server support for calling
exports.callNotification2 = functions.https.onRequest((req, res) => {
  // Grab the text parameter.
  const input = req.query.text;
  var split = input.split("---");
  var senderName = split[0];
  var receiverId = split[1];

  //The id of the room for the video/voice call
  var roomId = split[2];

  //Callers profile picture
  var senderPic = split[3];

  //Deals with a nuance in sending data in urls
  senderPic = senderPic.replace("*","%2f");

  let AuthUser = function(data) {
    return admin.firestore().collection('users').doc(receiverId).get("deviceToken");
  }

  let userToken = AuthUser("test");

  userToken.then(function(result){
    console.log("token" , result.data().deviceToken);
    const payload = {
      notification: {
        title: "Call incoming" ,
        body: "From: " + senderName
      },
      data: {
        room: roomId,
        sender: senderName,
        callerPic: senderPic
      },
      token: result.data().deviceToken
    };
    admin.messaging().send(payload).then(function(response) {
            console.log("Successfully sent message:", response);
            return res.status(500);
        })
        .catch(function(error) {
            console.log("Error sending message:", error);
            return res.status(500);
        });
          return res.status(200).send('ok');
  }).catch(error => { return res.status(500) });
});
