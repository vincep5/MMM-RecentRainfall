'use strict';


Module.register("MMM-RecentRainfall", {
    // create a variable to hold the location name based on the API result.
    fetchedLocationName: "",
    date_start_string: "",
    date_end_string: "",
    // Default module config.
    defaults: {
        updateInterval: 2 * 60 * 60 * 1000, // every 2 hours (see below: only from 6am-11am)
        station_id: 'JFK', // id via http://www.rcc-acis.org/docs_metadata.html
        days_to_get: 7, // number greater than 1
        show_image: false, // show the sum of rainfall as an image
        state_id: 'ny', // if show_image is true, then this is required
        image_width: 200 // if show_image is true, then this is required
    },
   
    start: function() {
        this.loaded = false;
        this.getData();
        this.scheduleUpdate();
    },

    // Override getHeader method.
    getHeader: function() {
        return this.data.header + " " + this.fetchedLocationName;
    },
    
    getStyles: function() {
        return ["MMM-RecentRainfall.css"];
    },
    
    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("recentrainfall");
        var rainfall = 0;

        if (!this.loaded) {
            wrapper.innerHTML = this.translate("LOADING");
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        wrapper.className = 'small bright';
        
        // get the amount of rain the the past X days
        if (this.result && this.result.data && this.result.data.length > 0) {
            this.result.data.forEach(function(rain) {
                if(!isNaN(rain[1])) {
                    rainfall += Number(rain[1]);
                }
            });
            this.fetchedLocationName = this.result.meta.name;
        }

        rainfall = parseFloat(rainfall).toFixed(2);

        var rainElement = document.createElement("span");
        rainElement.innerHTML = this.config.days_to_get + " day rainfall: " + rainfall + "\"";

        var divElement = document.createElement("div");
        divElement.appendChild(rainElement);

        wrapper.appendChild(divElement);
        
        if (this.config.show_image) {
            var imageElement = document.createElement("img");
            var obj = {
                        "state": this.config.state_id,
                        "grid":"1",
                        "output":"image",
                        "sdate": this.date_start_string,
                        "edate": this.date_end_string,
                        "elems":[{
                            "name":"pcpn",
                            "interval":"dly",
                            "duration":"mtd",
                            "reduce":"sum"
                        }],
                        "image":{
                            "proj":"lcc",
                            "overlays":[
                                "county:1:gray",
                                "state:2:purple"
                            ],
                            "interp":"cspline",
                            "width": this.config.image_width
                        }
                      };
            
            imageElement.src = "http://data.rcc-acis.org/GridData?params=" + JSON.stringify(obj);
            
            wrapper.appendChild(imageElement);
        }
        
        return wrapper;
    },

    scheduleUpdate: function(delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }

        var self = this;
        setInterval(function() {
            self.getData();
        }, nextLoad);
    },

    getData: function () {
        // only get data from about 6am to 11am.  Historical data will not change, so no use in calling this throughout the daytime
        // keep updateInterval at 2 hours
        var hr = new Date(Date.now()).getHours();
        if (this.loaded && (hr < 6 || hr > 11)) {
            return;
        }       
        
        var self = this;
        var days = this.config.days_to_get;
        
        // let's not get any more than 365 days in the API call
        if (this.config.days_to_get > 365) {
            days = 365;
        }
        
        var date_start = new Date(Date.now());
        var date_end = new Date(Date.now());
        date_start.setDate(date_start.getDate() - days);
        date_end.setDate(date_end.getDate() - 1);

        //format for the YYYY-MM-DD in the api
        this.date_start_string = date_start.getFullYear() + "-" + (date_start.getMonth()+1) + "-" + date_start.getDate();
        this.date_end_string = date_end.getFullYear() + "-" + (date_end.getMonth()+1) + "-" + date_end.getDate();
        
        var data = new FormData();
        var obj = {
                    "sid": this.config.station_id,
                    "sdate": this.date_start_string,
                    "edate": this.date_end_string,
                    "elems": [{
                        "name": "pcpn"
                    }],
                    "meta": ["name"]
                  };
                  
        data.append("params", JSON.stringify(obj));
        
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://data.rcc-acis.org/StnData");
        xhr.onreadystatechange = function() {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    self.result = JSON.parse(this.response);
                    self.loaded = true;
                    self.updateDom(2000);
                } else {
                    Log.error(self.name + " : Could not load data.");
                }
            }
        };
        xhr.send(data); 
    },

});