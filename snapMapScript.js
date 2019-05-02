"use strict";

var centre={}; // coordinates of screen centre 
var mapCanvas; // canvas for on-screen graphics
var refNW={}; // two reference points
var refSE={};
var mapName; // name of current map file
var map={}; // properties of current map
var mapX=0; // position of map top/left relative to screen
var mapY=0;
var zoom=1; // map magnification (inverse): 1 (max size), 2, 4, 8, 16 (1/16th scale)
var x, y, x0, y0; // horizontal and vertical coordinates/measurements
var offset = {};
var status; // location & trip data
var json;
var tracking = false;
// var metric = false;
var geolocator = null;
var lon, lat; // longitude and latitude (degrees)
var loc={};
var lastLoc = {};
var fix;
var fixes=[];
var track = []; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
var accuracy, dist, distance, heading, speed, hi, lo, climb, time0, moving; // fix & track data
var deg = "&#176;";
var compass="N  NNENE ENEE  ESESE SSES  SSWSW WSWW  WNWNW NNWN  ";
var months="JanFebMarAprMayJunJulAugSepOctNovDec";
var notifications=[];

// EVENT LISTENERS
console.log("add event listeners");
id("actionButton").addEventListener("click", getFix);
id("stopButton").addEventListener("click", cease);
// id("mapOverlay").addEventListener("click", moveTo);
id("mapOverlay").addEventListener("touchstart", startMove);
// id("mapOverlay").addEventListener("mousedown", startMove);
id("mapOverlay").addEventListener("touchmove", move);
// id("mapOverlay").addEventListener("mousemove", move);
id("menuButton").addEventListener("click", function() {
	console.log("toggle menu");
	var display = id("menu").style.display;
	id("menu").style.display = (display=="block")?"none":"block";
});
id('minusButton').addEventListener('click', function() {
	console.log("zoom out");
});
id('plusButton').addEventListener('click', function() {
	console.log("zoom in");
});
/*
id("metric").addEventListener("change", function() {
	metric=this.checked;
	window.localStorage.setItem('metric', metric);
	console.log("metric is "+metric);
	id("menu").style.display = "none";
});
*/
id("tracks").addEventListener("click", listTracks);
id('buttonSetCoords').addEventListener('click', function() {
	var easting=id('easting').value;
	var northing=id('northing').value;
	console.log('coords: '+easting+','+northing+" status: "+status);
	if(status<1) { // NW reference point
		status++;
		refNW.x=centre.x-mapX;
		refNW.y=centre.y-mapY;
		refNW.e=parseInt(easting);
		refNW.n=parseInt(northing);
		console.log("NW ref.pt: "+refNW.x+","+refNW.y+"; "+refNW.e+","+refNW.n);
		id('coordsHeader').innerHTML='SE reference point';
		id('easting').value='';
		id('northing').value='';
	}
	else {
		refSE.x=centre.x-mapX;
		refSE.y=centre.y-mapY;
		refSE.e=parseInt(easting);
		refSE.n=parseInt(northing);
		console.log("SE ref.pt: "+refSE.x+","+refSE.y+"; "+refSE.e+","+refSE.n);
		map.xScale=(refSE.e-refNW.e)/(refSE.x-refNW.x);
		map.yScale=(refNW.n-refSE.n)/(refSE.y-refNW.y);
		console.log("scale: "+map.xScale+"x"+map.yScale);
		// calculate mapW, mapN
		map.e=refNW.e-refNW.x*map.xScale;
		map.n=refNW.n+refNW.y*map.yScale;
		console.log("map.e: "+map.e+"; map.n: "+map.n);
		window.localStorage.setItem(mapName,JSON.stringify(map));
		id('coordsDialog').style.display='none';
		id('actionButton').style.display='block';
	}
})
id("saveButton").addEventListener("click", saveTrack);
id("cancelButton").addEventListener("click", function() {
	id("saveDialog").style.display="none";
});
id("mapChooser").addEventListener('change', function() { // LOAD MAP IMAGE
	var file = id('mapChooser').files[0];
	console.log("map: "+file+" name: "+file.name);
	mapName=file.name;
	var fileReader=new FileReader();
	fileReader.addEventListener('load', function(evt) {
		id('map').src=evt.target.result;
		id('mapHolder').style.left=id('mapHolder').style.top=0;
		mapX=mapY=0;
		// map.w=id('map').width;
		// map.h=id('map').height;
		// console.log("map size: "+map.w+"x"+map.h);
		redraw();
		id('mapDialog').style.display='none';
		var data=window.localStorage.getItem(mapName);
		console.log("saved data for "+mapName+": "+data);
		if(data!=null) {
			map=JSON.parse(data);
			// map=window.localStorage.getItem(mapName);
			id('actionButton').style.display='block';
			console.log("loaded data for map "+mapName+" at "+map.e+","+map.n+"scales: "+map.xScale+"x"+map.yScale);
		}
		else {
			id('coordsHeader').innerHTML="NW reference point";
			id('easting').value='';
			id('northing').value='';
			status=0;
			id('coordsDialog').style.display='block';
		}
		//id('map').style.width=sw+'px';
		//id('map').style.height=sh+'px';
		// id('map').style.left=10+'px';
		// id('map').style.transform='rotate(45deg)';
		// id('map').style.transform='scale(0.5)';
  	});
  	fileReader.readAsDataURL(file);
  },false);

centre.x=screen.width/2;
centre.y=screen.height/2;
console.log("centre at "+centre.x+","+centre.y);
id("mapHolder").style.width = screen.width+'px';
id("mapHolder").style.height = screen.height+'px';
mapCanvas = id("mapCanvas").getContext("2d"); // set up drawing canvas
id("mapCanvas").width = screen.width;
id("mapCanvas").height = screen.height;
id("actionButton").style.left=(screen.width-70)+'px';
id("actionButton").style.top=(screen.height-150)+'px';
id("stopButton").style.left=(20)+'px';
id("stopButton").style.top=(screen.height-70)+'px';
console.log("buttons moved!");
id("actionButton").style.display='block';
id("map").style.display = 'block';
status=window.localStorage.getItem('map'); // URL of current map
console.log('saved map: '+status);
if(status!='null') {
	id('map').src=status;
	status = window.localStorage.getItem('loc'); // recover last location
	console.log("location status: "+status);
	if(status!='null') {
		json = JSON.parse(status);
		loc.e = json.e;
		loc.n = json.n;
	}
	// centreMap(); // go to saved location
	/* saved track
	status = window.localStorage.getItem('osNavTrip'); // recover previous trip stats
	if(status) {
		json=JSON.parse(status);
		var text="last trip distance: ";
		if(metric) text += decimal(json.distance/1000)+"km";
		else text += decimal(json.distance/1093.6)+"miles";
		text += " in ";
		if(json.time>60) text+=Math.floor(json.time/60)+" hr ";
		text+=json.time%60+" min (";
		if(json.moving>60) text+=Math.floor(json.moving/60)+"hr ";
		text+=json.moving%60+" min); speed: ";
		if(metric) text += Math.round(json.distance*60/1000/json.time)+"kph; ";
		else text += Math.round(json.distance*60/1093.6/json.time)+"mph; ";
		if(metric ) text += json.climb+" m climbed";
		else text += Math.round(json.climb*3.281)+"ft climbed";
		alert(text);
	}
	*/
}
else {
	id('actionButton').style.display='none';
	id('mapDialog').style.display='block';
}
// metric = window.localStorage.getItem("metric");
// id('metric').checked = metric;
	
	
	function listTracks() {
		document.getElementById("menu").style.display = "none";
		// alert("list saved tracks - can load or delete");
		// get list of saved tracks
		var tracks = window.localStorage.getItem("wpTracks");
		notify("tracks:" + tracks);
		if(!tracks) return;
		var names = JSON.parse(tracks).names;
		notify("first track: "+names[0]);
		/*
		for(var i=0; i<names.length; i++) {
			document.getElementById("list").innerHTML += "<li>"+names[i]+"</li>";
		}
		notify("list: "+document.getElementById("list").innerHTML);
		*/
		document.getElementById("list").innerHTML=""; // clear list
		var html="";
		for(var i=0; i<names.length; i++) {
  			var listItem = document.createElement('li');
			listItem.index=i;
	 		// listItem.classList.add('log-item');
			// listItem.addEventListener('click', function(){app.logIndex=this.index; app.openLog();});
			html="<button class='deleteButton'>";
			html+=names[i]+"<br>";
			// html+="----X"; // JUST TESTING!!!
			listItem.innerHTML=html;
			document.getElementById('list').appendChild(listItem);
  		}
		alert("list: "+document.getElementById("list").innerHTML);
		// list with onclick action to load into track[] and draw track/display distance etc...
		// ...plus X to delete from database (via "delete?" dialog)
		// show list with "tracks" title and X buttom to close without action
		document.getElementById("list").style.display = "block";
	}
	
	function startMove(event) {
		var touches=event.changedTouches;
		x0=touches[0].clientX;
		y0=touches[0].clientY;
		// console.log("start drag at "+x0+","+y0);
		// notify("start drag");
		document.getElementById('list').style.display='none';
		document.getElementById('menu').style.display='none';
	}
	
	function move(event) {
		document.getElementById('menu').style.display='none';
		var touches=event.changedTouches;
		x=touches[0].clientX;
		y=touches[0].clientY;
		// notify("drag by "+x+"x"+y+"px");
		mapX+=(x-x0);
		mapY+=(y-y0);
		// console.log('map at '+mapX+','+mapY);
		id('mapHolder').style.left=mapX+'px';
		id('mapHolder').style.top=mapY+'px';
		// loc.lon-=(x-x0)/14400;
		// loc.lat+=(y-y0)/24000;
		x0=x;
		y0=y;
		// centreMap();
		if(map.xScale>0) { // once map is calibrated, adjust and display coords
			x=centre.x-mapX;
			y=centre.y-mapY;
			var e=Math.round(x*map.xScale+map.e);
			var n=Math.round(map.n-y*map.yScale);
			id('heading').innerHTML=e+' '+n;
		}
	}
	/*
	function moveTo(event) {
		document.getElementById("list").style.display = "none";
		document.getElementById('menu').style.display='none';
		x=sw/2-event.clientX;
		y=sh/2-event.clientY;
		console.log("move to "+x+", "+y+" from current position");
		loc.lat+=y/24000;
		loc.lon-=x/14400;
		if(measuring) {
			var node={};
			node.lon=loc.lon;
			node.lat=loc.lat;
			nodes.push(node);
			distance+=measure('distance',lastLoc.lon,lastLoc.lat,loc.lon,loc.lat);
			console.log('distance: '+distance+"m");
			lastLoc.lon=loc.lon;
			lastLoc.lat=loc.lat;
		}
		centreMap();
	}
	*/
	function addTP() {
		notify("add trackpoint "+track.length);
		var tp={};
		tp.e=loc.e;
		tp.n=loc.n;
		tp.alt=loc.alt;
		tp.time=loc.time;
		track.push(tp);
		redraw();
		if(track.length<2) return;
		var trip={};
		trip.distance=decimal(distance+dist); // metres
		trip.time=Math.round((loc.time-track[0].time)/60); // minutes
		trip.moving=Math.round(moving/60); // minutes not stopped
		trip.climb=climb; // metres
		var json=JSON.stringify(trip);
		// console.log("save trip "+json);
		window.localStorage.setItem('wpTrip', json);
	}
	
	function getFix() { // get fix on current location
		if(navigator.geolocation) {
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
			navigator.geolocation.getCurrentPosition(gotoFix,locationError,opt);
		}
	}
	
	function gotoFix(position) {
		console.log("gotoFix");
		lon=position.coords.longitude;
		lat=position.coords.latitude;
		loc.alt=position.coords.altitude;
		if(loc.alt!=null) loc.alt=Math.round(loc.alt);
		notify("fix at "+lon+","+lat+","+loc.alt);
		bng();
		mapX=centre.x-(loc.e-map.e)/map.xScale;
		mapY=centre.y-(map.n-loc.n)/map.yScale;
		id('mapHolder').style.left=mapX+'px';
		id('mapholder').style.top=mapY+'px';
		// centreMap();
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", getFix);
		document.getElementById("actionButton").addEventListener("click", go);
		ready=true;
		window.setTimeout(timeUp,15000); // revert to fix button after 15 secs
	}
	
	function timeUp() {
		if(tracking) return;
		console.log("times up - back to fix button");
		document.getElementById("actionButton").innerHTML='<img src="fixButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", getFix);
		ready=false;
	}

	
	function go() { // start tracking location
		tracking = true;
		track = [];
		loc = {};
		lastLoc = {};
		distance = 0;
		time0 = moving = 0;
		heading = 0;
		speed = 0;
		hi = lo = climb = 0;
		notify("start tracking");
		fix=0;
		fixes=[];
	    if (navigator.geolocation) {
			var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
        		geolocator = navigator.geolocation.watchPosition(sampleLocation, locationError, opt);
    	} else  {
       		alert("Geolocation is not supported by this browser.");
    	}
		document.getElementById("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", go);
		document.getElementById("actionButton").addEventListener("click", stopStart);
		/* test BNG conversion
		console.log("convert 52*39'27.2531N, 1*43'4.5177W to BNG");
		lat=52.6575703;
		lon=1.71792158;
		bng();
		*/
	}
	
	function stopStart() {
		console.log("stopStart");
		if(tracking) pause();
		else resume();
	}
	
	function pause() { // pause location tracking
		console.log("PAUSE");
		addTP(); // add trackpoint on pause
		tracking = false;
		navigator.geolocation.clearWatch(geolocator);
		document.getElementById("stopButton").style.display="block";
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		// document.getElementById("actionButton").removeEventListener("click", go);
		// document.getElementById("actionButton").removeEventListener("click", resume);
		// document.getElementById("actionButton").addEventListener("click", resume);
	}
	
	function resume() { // restart tracking after pausing
		console.log("RESUME");
		document.getElementById("stopButton").style.display="none";
		document.getElementById("actionButton").innerHTML='<img src="pauseButton24px.svg"/>';
		// document.getElementById("actionButton").removeEventListener("click", resume);
		// document.getElementById("actionButton").addEventListener("click", pause);
		tracking = true;
		var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
		geolocator = navigator.geolocation.watchPosition(sampleLocation, locationError, opt);
	}
	
	function sampleLocation(position) {
		var accuracy=position.coords.accuracy;
		// notify("fix "+fix+" accuracy: "+accuracy);
		if(accuracy>50) return; // skip inaccurate fixes
		fixes[fix]={};
		fixes[fix].lon=position.coords.longitude;
		fixes[fix].lat=position.coords.latitude;
		fixes[fix].alt=position.coords.altitude;
		fix++;
		if(fix<3) return;
		fix=0; // reset to get next three sample fixes
		var now=new Date();
		loc.time=Math.round(now.getTime()/1000); // whole seconds
		lon=(fixes[0].lon+fixes[1].lon+fixes[2].lon)/3; // average location data
		lat=(fixes[0].lat+fixes[1].lat+fixes[2].lat)/3;
		loc.alt=Math.round((fixes[0].alt+fixes[1].alt+fixes[2].alt)/3);
		// notify(lon+","+lat+", "+loc.alt+"m accuracy:"+accuracy);
		if(track.length<1) { // at start, initialise lastLoc and...
		  lastLoc.time = loc.time
		  lastLoc.lon = lon;
		  lastLoc.lat = lat;
			addTP(); // ...add first trackpoint
		}
		else {
			dist = measure("distance",lon,lat,lastLoc.lon,lastLoc.lat); // distance since last averaged fix
			notify('moved '+dist+"m");
			if(dist > 5) moving += (loc.time - lastLoc.time);
		}
		lastLoc.time = loc.time
		lastLoc.lon = lon;
		lastLoc.lat = lat;
		var t=track.length-1; // most recent trackpoint
		dist=measure("distance",lon,lat,track[t].lon,track[t].lat); // distance since last trackpoint
		var interval=loc.time-track[t].time;
		if(dist>0) speed = dist / interval; // current speed m/s
		var direction=measure("heading",track[t].lon,track[t].lat,lon,lat); // heading since last trackpoint
		var turn=Math.abs(direction-heading);
		if(turn>180) turn=360-turn;
		if((hi == 0) || ((lo - loc.alt) > 5)) {
			hi = lo = loc.alt; // reset lo and hi at first trackpoint or new lo-point
			notify("new lo (and hi)");
		}
		else if((loc.alt - hi) > 5) {
			lo = hi;
			hi = loc.alt; // climbing - set new hi-point
			climb += (hi-lo); // increment total climbed
			notify("climbing - new hi");
		}
		else if((hi - loc.alt) > 5) { // going over the top
			hi = lo = loc.alt; // reset hi & lo until climbing again
			notify("OTT - new hi & lo");
		}
		notify("lo:"+lo+" hi:"+hi+" climb:"+climb);
		if((dist>100)||(turn>30)) { // add trackpoint after 100m or when direction changes > 30*
			distance += dist;
			heading = Math.round(direction);
			addTP();
			dist = 0;
		}
		bng(); // convert loc/lon to BNG coords
		mapX=centre.x-(loc.e-map.e)/map.xScale;
		mapY=centre.y-(map.n-loc.n)/map.yScale;
		id('mapHolder').style.left=mapX+'px';
		id('mapholder').style.top=mapY+'px';
		// centreMap();
	}
	
	function locationError(error) {
		var message="";
		switch (error.code) {
			case error.PERMISSION_DENIED:
				message="location request denied";
				break;
			case error.POSITION_UNAVAILABLE:
				message="location not available";
				break;
			case error.TIMEOUT:
				message="location timeout";
				break;
			case error.UNKNOWN_ERROR:
				message="unknown loaction error";
		}
		alert(message);
	}
	
	function cease(event) {
		notify("CEASE tracking is "+tracking+"; "+track.length+" trackpoints");
		navigator.geolocation.clearWatch(geolocator);
		document.getElementById("stopButton").style.display="none";
		document.getElementById("actionButton").innerHTML='<img src="goButton24px.svg"/>';
		document.getElementById("actionButton").removeEventListener("click", stopStart);
		document.getElementById("actionButton").addEventListener("click", go);
		document.getElementById("heading").innerHTML = "White Peak";
		redraw();
		// IF TRACK HAS MORE THAN 5 TRACKPOINTS, OFFER TO SAVE TO DATABASE USING DIALOG TO GIVE DEFAULT (EDITABLE) NAME 'YYMMDD-HH:MM'
		if(track.length>1) { // ************  CHANGE TO 5 **************
			var now = new Date();
			var name = now.getYear()%100 + months.substr(now.getMonth()*3,3) + now.getDate() + '.'; // YYmonDD
			var t =now.getHours();
			if(t<10) name+="0";
			name+=(t+":");
			t=now.getMinutes();
			if(t<10) name+="0";
			name+=t; // YYmonDD.HH:MM
			notify("track name: "+name);
			document.getElementById("trackName").value = name;
			document.getElementById("saveDialog").style.display = "block";
		}
	}

	function redraw() {
	  var i, p, x, y, r, d, t;
	  notify("redraw - tracking is "+tracking);
	  mapCanvas.clearRect(0, 0, screen.width, screen.height);
		mapCanvas.lineWidth = 5;
		mapCanvas.strokeStyle = 'rgba(0,0,255,0.5)';
		mapCanvas.fillStyle = 'rgba(0,0,0,0.7)';
		mapCanvas.textBaseline = 'top';
		if(distance>0) { // display distance travelled and height climbed so far
			var gradient = mapCanvas.createLinearGradient(0,32,0,182);
			gradient.addColorStop(0,'white');
			gradient.addColorStop(1,'#FFFFFF00');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,32,screen.width,182);
			mapCanvas.fill();
			mapCanvas.fillStyle = 'black';
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'left';
			d = distance+dist;
			// if(metric) { // metric units
				d=Math.round(d);
				if(d<1000) mapCanvas.fillText('m',5,45);
				else {
					mapCanvas.fillText('km',5,45);
					d=decimal(d/1000);
				}
			/*	
			}
			else { // miles & yards
				d=Math.round(d*1.093613); // nearest yard to latest trackpoint
				if(d<1760) mapCanvas.fillText('yds',5,45);
				else {
					mapCanvas.fillText('miles',5,45);
					d=decimal(d/1760);
				}
			}
			*/
			if(track.length>0) {
				mapCanvas.fillText('time (moving)', 100, 45);
				t=Math.floor((loc.time-track[0].time)/60); // total trip time (minutes)
				mapCanvas.font = 'Bold 24px Sans-Serif';
				var text = Math.floor(t/60)+":";
				t%=60;
				if(t<10) text += "0";
				text += t + " ("
				t = Math.floor(moving/60); // minutes not stopped
				text += (Math.floor(t/60)+":");
				t%=60;
				if(t<10) text += "0";
				text += (t +")");
				mapCanvas.fillText(text, 100, 60);
			}
			mapCanvas.font = 'Bold 36px Sans-Serif';
			mapCanvas.fillText(d,5,57);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			mapCanvas.textAlign = 'right';
			// mapCanvas.fillText(((metric)?"m":"ft")+" climbed",screen.width-5,45);
			mapCanvas.font = 'Bold 36px Sans-Serif';
			// mapCanvas.fillText(Math.round((metric)?climb:climb*3.281),screen.width-5,57);
		}
		if(tracking && speed>0) { // if tracking show current altitude with coordinates
			gradient = mapCanvas.createLinearGradient(0,sh-150,0,sh);
			gradient.addColorStop(0,'#FFFFFF00');
			gradient.addColorStop(1,'white');
			mapCanvas.fillStyle = gradient;
			mapCanvas.fillRect(0,sh-150,screen.width,screen.height);
			mapCanvas.fillStyle = 'black';
			mapCanvas.textBaseline = 'alphabetic';
			mapCanvas.textAlign = 'left';
			mapCanvas.font = 'Bold 60px Sans-Serif';
			// mapCanvas.fillText(Math.round(((metric)?3.6:2.237)*speed), 5,sh-20);
			mapCanvas.font = 'Bold 16px Sans-Serif';
			// mapCanvas.fillText((metric)?"kph":"mph", 5,sh-5);
			mapCanvas.font = 'Bold 36px Sans-Serif';
			d=Math.round((heading+11.25)/22.5); // 16 compass directions: N, NNE, NE,...
			d=compass.substr(d*3,3); // compass point eg. NNE
			mapCanvas.fillText(d,100,sh-20);
		}
		mapCanvas.beginPath(); // draw current track as blue line
	    if (track.length > 1) {
			  notify("draw track - "+track.length+" trackpoints");
	    	p = track[0];
	    	x=mapX-(map.e-p.lon)*14400;
	    	y=mapY-(p.lat-map.n)*24000;
	    	mapCanvas.moveTo(x, y);
	    	for (i = 1; i < track.length; i++) {
	    		p = track[i];
	       	x=mapX-(map.e-p.lon)*14400;
	       	y=mapY-(p.lat-map.n)*24000;
	       	mapCanvas.lineTo(x, y);
	    	}
			if(tracking) mapCanvas.lineTo(centre.x,centre.y);
		}
		console.log("draw cross");
		mapCanvas.moveTo(centre.x-20,centre.y); // blue cross at current location
		mapCanvas.lineTo(centre.x-5,centre.y);
		mapCanvas.moveTo(centre.x+5,centre.y);
		mapCanvas.lineTo(centre.x+20,centre.y);
		mapCanvas.moveTo(centre.x,centre.y-20);
		mapCanvas.lineTo(centre.x,centre.y-5);
		mapCanvas.moveTo(centre.x,centre.y+5);
		mapCanvas.lineTo(centre.x,centre.y+20);
		mapCanvas.stroke();
	}
	/*
	function centreMap() { // move map to current location
		// notify("centre map");
	  var i, x, y;
	  mapX = (map.e - loc.lon) * 14400 + sw / 2;
	  mapY = (loc.lat - map.n) * 24000 + sh / 2;
		// console.log("map position: "+mapX+", "+mapY);
		var map = document.getElementById("map");
		map.style.left = mapX+"px";
		map.style.top = mapY+"px";
		var string = dm(loc.lat, true) + " " + dm(loc.lon, false) + " ";
		if(tracking) string += (metric)?loc.alt+"m":Math.round(3.281*loc.alt)+"ft";
		document.getElementById('heading').innerHTML = string;
		redraw();
		json=JSON.stringify(loc);
		// console.log("save location "+json);
		window.localStorage.setItem('wpLocation', json);
	}
	*/
	function saveTrack() {
	  var name = document.getElementById("trackName").value;
	  var names=[];
	  notify("save track "+name);
		var tracks = window.localStorage.getItem("wpTracks");
		if(tracks) {
		  names = JSON.parse(tracks).names;
		  notify(names.length+" tracks already saved");
		  if((name.length<1)||(names.indexOf(name)>=0)) return;
		}
		json = JSON.stringify(track);
		window.localStorage.setItem(name, json);
		names.push(name);
		tracks={};
		tracks.names=names
		var json=JSON.stringify(tracks);
		window.localStorage.setItem("wpTracks",json);
		document.getElementById("saveDialog").style.display="none";
	}
	
	// UTILITY FUNCTIONS
	function id(el) {
		return document.getElementById(el);
	}
	
	function bng() { // convert lon/lat to BNG coords
		var p=lat*Math.PI/180; // loc/lat in radians
		var q=lon*Math.PI/180;
		var a=6377563.396; // Airy major and minor semi-axes
		var b=6356256.909;
		var f0=0.9996012717; // BNG scale factor on central meridian
		var p0=49*Math.PI/180; // true origin for BNG is 49*N 2*W
		var q0=-2*Math.PI/180;
		var n0=-100000; // true origin BNG coords
		var e0=400000;
		// var e2=1-(b*b)/(a*a); // eccentricity squared
		var e2=(a*a-b*b)/(a*a); // eccentricity squared
		var n=(a-b)/(a+b);
		var n2=n*n;
		var n3=n2*n;
		var pCos=Math.cos(p);
		var pSin=Math.sin(p);
		var nu=a*f0/Math.sqrt(1-e2*pSin*pSin); // transverse radius of curvature
		console.log("nu: "+nu);
		var rho=a*f0*(1-e2)/Math.pow(1-e2*pSin*pSin,1.5); // meridian radius of curvature;
		console.log("rho: "+rho);
		var eta2=nu/rho-1;
		console.log("eta2: "+eta2);
		var ma=(1+n+(5/4)*n2+(5/4)*n3)*(p-p0);
		var mb=(3*n+3*n2+(21/8)*n3)*Math.sin(p-p0)*Math.cos(p+p0);
		var mc=((15/8)*n2+(15/8)*n3)*Math.sin(2*(p-p0))*Math.cos(2*(p+p0));
		var md=(35/24)*n3*Math.sin(3*(p-p0))*Math.cos(3*(p+p0));
		var m=b*f0*(ma-mb+mc-md);
		console.log("m: "+m+"; n0: "+n0);
		var pCos3=pCos*pCos*pCos;
		var pCos5=pCos3*pCos*pCos;
		var pTan2=Math.tan(p)*Math.tan(p);
		var pTan4=pTan2*pTan2;
		var v1=m+n0;
		console.log("I: "+v1);
		var v2=(nu/2)*pSin*pCos;
		console.log("II: "+v2);
		var v3=(nu/24)*pSin*pCos3*(5-pTan2+9*eta2);
		console.log("III: "+v3);
		var v4=(nu/720)*pSin*pCos5*(61-58*pTan2+pTan4);
		console.log("IIIa: "+v4);
		var v5=nu*pCos;
		console.log("IV: "+v5);
		var v6=(nu/6)*pCos3*(nu/rho-pTan2);
		console.log("V: "+v6);
		var v7=(nu/120)*pCos5*(5-18*pTan2+pTan4+14*eta2-58*pTan2*eta2);
		console.log("VI: "+v7);
		var dq=q-q0;
		var dq2=dq*dq;
		var dq3=dq2*dq;
		var dq4=dq3*dq;
		var dq5=dq4*dq;
		var dq6=dq5*dq;
		loc.n=v1+v2*dq2+v3*dq4+v4*dq6;
		loc.e=e0+v5*dq+v6*dq3+v7*dq5;
		console.log("fix is at BNG "+loc.e+" "+loc.n);	
	}
	
	function dm(degrees, lat) {
	    var ddmm;
	    var negative = false;
	    var n;
	    if (degrees < 0) {
	        negative = true;
	        degrees = degrees * -1;
	    }
	    ddmm = Math.floor(degrees); // whole degs
	    n = (degrees - ddmm) * 60; // minutes
	    ddmm += deg;
	    if (n < 10) ddmm += "0";
	    ddmm += decimal(n) + "'";
	    if (negative) {
	        if (lat) ddmm += "S";
	        else ddmm += "W";
	    }
	    else {
	        if (lat) ddmm += "N";
	        else ddmm += "E";
	    }
	    return ddmm;
	}
	
	function measure(type,x0,y0,x,y) {
		var dx = x - x0;
	    var dy = y - y0;
        dx *= 66610; // allow for latitude
        dy *= 111111.111; // 90 deg = 10000 km
		if(type=="distance") return Math.sqrt(dx * dx + dy * dy);
		var h; // heading
		if (dy == 0) {
	        h = (dx > 0) ? 90 : 270;
	    }
	    else {
	        h = Math.atan(dx / dy) * 180 / Math.PI;
	        if (dy < 0) h += 180;
	        if (h < 0) h += 360 // range 0-360
        }
        return h;
	}
	
	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>10) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		var message="";
		for(var i in notifications) {
			message+=notifications[i]+"; ";
		}
		alert(message);
	}

// implement service worker if browser is PWA friendly
	if (navigator.serviceWorker.controller) {
		console.log('Active service worker found, no need to register')
	} else { //Register the ServiceWorker
		navigator.serviceWorker.register('sw.js').then(function(reg) {
			console.log('Service worker has been registered for scope:'+ reg.scope);
		});
	}
