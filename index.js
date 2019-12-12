// Begin POST handler
const http = require('http');
const Scheduler = require("./scheduler");
const server = http.createServer(function(request, response) {
  console.dir(request.param);

  if (request.method == 'POST') { // Checks for POST request
		var body = '';
    request.on('data', function(data) {
      body += data; // Appends data if key-value pair to body
    });

    request.on('end', function() {
			var scheduler = new Scheduler(JSON.parse(body));
			scheduler.getRanges();
			scheduler.sortByLowestAvailability();
			scheduler.createMatchQueue();
      // console.log(JSON.parse(body));
			
      response.end(JSON.stringify(scheduler.matchmake()));
    })
  }
})

const port = 3001;
server.listen(port);
console.log(`Listening on port ${port}`);

// End POST Handler