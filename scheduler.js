// Begin Scheduler init
class Scheduler {
	// Initialization function
	constructor(req) {
		this.begins = req.minDate;
		this.ends = req.maxDate;

		this.teams = req.teams;
		this.matchups = req.matchesRequired;
		this.finalMatches = {matches:[], unscheduled:[]}
	}

	getRanges() {
		this.teams.forEach( (team) => {
			team.ranges = [];
			team.matches = [];
			team.scheduledTimes = [];
			team.availability.forEach( (time) => {

				if (team.ranges.length >= 1) {

					if (team.ranges[team.ranges.length - 1][1] == time.startDate && team.ranges[team.ranges.length-1][1] - team.ranges[team.ranges.length - 1][0] <= 3600000) { // Checks if time ranges overlap and maximum 1.5h time range
						team.ranges[team.ranges.length - 1][1] = time.startDate + 1800000; 
					} else {
						team.ranges.push([time.startDate, time.startDate + 1800000]) // Time chunks are 30min long
					}

				} else {
					team.ranges.push([time.startDate, time.startDate + 1800000]) // Time chunks are 30min long
				}

			});
			
		}); 
	}

	sortByLowestAvailability() { // Prioritizes by team with lowest availability
		for (var i = 0; i < this.teams.length; i++) {
			for (var j=0; j < this.teams.length; j++) {
				if ((this.teams[i].ranges.length > this.teams[j].ranges.length && i < j) || (this.teams[i].ranges.length < this.teams[j].ranges.length && j < i)) // Checks if number of ranges is out of order
				{
					var temp = this.teams[j];
					this.teams[j] = this.teams[i];
					this.teams[i] = temp;
				} else if (this.teams[i].ranges.length == this.teams[j].ranges.length) { // Adds up total available time
					var rangeA = 0;
					var rangeB = 0;
					this.teams[i].ranges.forEach( (range) => {
						rangeA += (range[1] - range[0]);
					});
					this.teams[j].ranges.forEach( (range) => {
						rangeB += (range[1] - range[0]);
					});
					if ((rangeA > rangeB && i < j) || (rangeB > rangeA && j < i)) { // Prioritizes team with less overall available time
						var temp = this.teams[j];
						this.teams[j] = this.teams[i];
						this.teams[i] = temp;
					}
				}
			}
		}
		// Teams should now be sorted from lowest availability to highest availability
	}

	createMatchQueue() {
		// Assigns matches to high-priority teams to be used later
		this.matchups.forEach( (matchup) => {
			var teamA, teamB;
			this.teams.forEach( (team) => {
				// Assigns local variables for each team
				if (team.ulid == matchup.teamA) {
					teamA = this.teams.indexOf(team);
				} else if (team.ulid == matchup.teamB) {
					teamB = this.teams.indexOf(team);
				}
			});
			this.teams[teamA].matches.push(teamB);
			this.teams[teamB].matches.push(teamA);
		});
		this.matchQueue = [];
		this.teams.forEach( (team) => {
			team.matches.forEach( (m) => {
				this.matchQueue.push([this.teams.indexOf(team), m]);
				this.teams[m].matches.splice(this.teams[m].matches.indexOf(this.teams.indexOf(team)), 1)
			});
		});
	// Queue of matches is now created with higher priority matches being first
	}

	matchmake() {
		this.matchQueue.forEach( (match) => {
			// Finds all common times between the two participating teams
			var commonTimes = [];
			var timeIndex = [];
			this.teams[match[0]].availability.forEach( (timeA) => {
				this.teams[match[1]].availability.forEach( (timeB) => {
					if (timeA.startDate == timeB.startDate) {
						var p = 0;

						this.finalMatches.matches.forEach( (time) => {
							if ((timeA.startDate - 5400000) < time.startDate && time.startDate < (timeA.startDate + 5400000)) {
								p++;
							}
						});
					}
					if (p == 0){
						commonTimes.push(timeA.startDate);
						timeIndex.push(this.teams[match[0]].availability.indexOf(timeA));
						timeIndex.push(this.teams[match[1]].availability.indexOf(timeB));
					}
				});
			});

			
			// If no common times, pick one from team A
			if (commonTimes.length == 0) {
				this.teams[match[0]].availability.forEach( (pt) => {
					var p = 0;
					this.finalMatches.matches.forEach( (time) => {
							if ((pt.startDate - 5400000) < time.startDate && time.startDate < (pt.startDate + 5400000)) {
								p++;
							}
					});
					if (p == 0) {
						commonTimes.push(pt.startDate);
					}
				});
			}

			// If team A has no remaining availability, pick one from team B
			if (commonTimes.length == 0) {
				this.teams[match[1]].availability.forEach( (pt) => {
					var p = 0;
					this.finalMatches.matches.forEach( (time) => {
							if ((pt.startDate - 5400000) < time.startDate && time.startDate < (pt.startDate + 5400000)) {
								p++;
							}
					});
					if (p == 0) {
						commonTimes.push(pt.startDate);
					}
				});
			}

			if (commonTimes.length == 0) {
				this.finalMatches.unscheduled.push({
					teamA: this.teams[match[0]].ulid,
					teamB: this.teams[match[1]].ulid
				});
			} else {

				// For each common time, finds common times with every other team.
				var sharedAll = []
				commonTimes.forEach( (time) => {
					var c = 0;
					for (var t = 0; t < this.teams.length; t++) {
						var teamt = this.teams[t];
						if (teamt == this.teams[match[0]] || teamt == this.teams[match[1]])
							continue;
						teamt.availability.forEach( (slot) => {
							if (slot.startDate == time)
								c++;
						});
					};
					sharedAll.push(c);
				});	

				var scheduledTime = commonTimes[sharedAll.indexOf(Math.min.apply(null, sharedAll),)];
				// Schedules the match for the time with the lowest shared preferences among teams
				this.finalMatches.matches.push(
					{
						teamA: this.teams[match[0]].ulid,
						teamB: this.teams[match[1]].ulid,
						startDate: scheduledTime
					}
				);

				this.teams[match[0]].scheduledTimes.push(scheduledTime);
				this.teams[match[1]].scheduledTimes.push(scheduledTime);


				// Remove the scheduled time from all team's availability as that time can no longer be used. Also remove any time that is up to 1 hour ahead.
				this.teams.forEach( (team) => {
					var tempAvs = []
					team.availability.forEach( (a) => {
						tempAvs.push(a.startDate);
					});
					if (tempAvs.includes(scheduledTime)) {
						
						team.availability.splice(tempAvs.indexOf(scheduledTime), 1);
						team.availability.splice(tempAvs.indexOf(scheduledTime + 1800000), 1);
						team.availability.splice(tempAvs.indexOf(scheduledTime + 3600000), 1);
					}
				});
			}
		});
		return this.finalMatches;
	}
}

module.exports = Scheduler;
