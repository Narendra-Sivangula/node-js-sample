var express = require('express')
var app = express()

// Crashloop Testing Simulation - version06
//if (process.env.CRASH_ON_START === 'true') {
//  console.error('CRASH_ON_START=true, exiting for controlled crash-loop test')
//  process.exit(1)
//}

// Automated using ArgoCD And included image_digest - Latest
// For Testing

// Last Full End To End Testing
app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
  response.send('Hello World!')
})
app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})
