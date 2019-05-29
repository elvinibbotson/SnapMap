"use strict";

var sw,sh; // screen dimensions
var centre={}; // coordinates of screen centre 
var mapCanvas; // canvas for on-screen graphics
var refNW={}; // two reference points
var refSE={};
var mapName; // name of current map file
var map={}; // properties of current map
var mapX=0; // position of map top/left relative to screen
var mapY=0;
var zoom=1; // map magnification (inverse): 1 (max size), 2, 4, 8 (1/8th scale)
var x, y, x0, y0; // horizontal and vertical coordinates/measurements
var offset = {};
var status; // location & trip data
var json;
var tracking=false;
var geolocator=null;
var lon, lat; // longitude and latitude (degrees)
var loc={};
var lastLoc={};
var fix;
var fixes=[];
var track=[]; // array of track objects - locations, altitudes, timestamps, lengths, durations,...
var accuracy,dist,distance,heading; // fix & track data
var breadcrumb=new Image(10,10);
var quadrant='NW'; // 4 quadrants used by buildMap
var mapQuadrant; // map image for one quadrant of built map
var anchor; // point on canvas where quadrants meet
var deg = "&#176;";
var notifications=[];

// status=window.localStorage.getItem('map'); // URL of current map
// console.log('saved map: '+status);
// EVENT LISTENERS
console.log("add event listeners");
window.onresize=function(evt) {
	sh=window.innerHeight;
	centre.y=sh/2;
	id("mapHolder").style.height=sh+'px';
	id("mapCanvas").height=sh;
	id("actionButton").style.top=(sh-70)+'px';
	// console.log("screen height: "+sh+"px");
	redraw();
};
id("actionButton").addEventListener("click", go);
id("actionButton").addEventListener("dblclick", function() {
	notify("restart");
	if(!tracking && track.length>0) {
		track=[];
		go();
	}
});
id("mapOverlay").addEventListener("touchstart", startMove);
id("mapOverlay").addEventListener("touchmove", move);
id("menuButton").addEventListener("click", function() {
	console.log("toggle menu");
	var display = id("menu").style.display;
	id("menu").style.display = (display=="block")?"none":"block";
});
id('loadMap').addEventListener('click',function() {
	id('actionButton').style.display='none';
	id('menu').style.display='none';
	id('mapDialog').style.display='block';
});
id('calibrate').addEventListener('click',calibrate);
id('buildMap').addEventListener('click',mapBuilder);
id('notifications').addEventListener('click',showNotifications);
id('minusButton').addEventListener('click', function() {
	console.log("zoom out loc.e: "+loc.e+" map.e: "+map.e+' xScale: '+map.xScale);
	if(zoom<8) {
		zoom*=2;
		id('map').width/=2;
		// id('map').height/=2;
		console.log("zoom: "+zoom+"; map size; "+id('map').width+"x"+id('map').height);
		mapX=centre.x-(loc.e-map.e)/(map.xScale*zoom);
		mapY=centre.y-(map.n-loc.n)/(map.yScale*zoom);
		console.log('at '+mapX+','+mapY);
		id('mapHolder').style.left=mapX+'px';
		id('mapHolder').style.top=mapY+'px';
		redraw();
	}
});
id('plusButton').addEventListener('click', function() {
	console.log("zoom in");
	if(zoom>1) {
		zoom/=2;
		id('map').width*=2;
		// id('map').style.height*=2;
		mapX=centre.x-(loc.e-map.e)/(map.xScale*zoom);
		mapY=centre.y-(map.n-loc.n)/(map.yScale*zoom);
		id('mapHolder').style.left=mapX+'px';
		id('mapHolder').style.top=mapY+'px';
		redraw();
	}
});
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
		map.e=refNW.e-refNW.x*map.xScale*zoom;
		map.n=refNW.n+refNW.y*map.yScale*zoom;
		console.log("map.e: "+map.e+"; map.n: "+map.n);
		window.localStorage.setItem(mapName,JSON.stringify(map));
		loc.e=refSE.e;
		loc.n=refSE.n;
		id('heading').innerHTML=loc.e+' '+loc.n;
		id('coordsDialog').style.display='none';
		id('actionButton').style.display='block';
	}
})
id("mapChooser").addEventListener('change', function() { // LOAD MAP IMAGE
	var file = id('mapChooser').files[0];
	console.log("map: "+file+" name: "+file.name);
	mapName=file.name;
	var fileReader=new FileReader();
	fileReader.addEventListener('load', function(evt) {
		id('map').src=evt.target.result;
		id('map').onload=redraw();
		// save url as 'currentMap'?
		id('mapHolder').style.left=id('mapHolder').style.top=0;
		mapX=mapY=0;
		redraw();
		id('mapDialog').style.display='none';
		var data=window.localStorage.getItem(mapName);
		console.log("saved data for "+mapName+": "+data);
		if(data!=null) {
			map=JSON.parse(data);
			// map=window.localStorage.getItem(mapName);
			id('actionButton').style.display='block';
			console.log("loaded data for map "+mapName+" at "+map.e+","+map.n+"scales: "+map.xScale+"x"+map.yScale);
			loc.e=Math.round(map.e+centre.x*map.xScale*zoom);
			loc.n=Math.round(map.n-centre.y*map.yScale*zoom);
			id('heading').innerHTML=loc.e+' '+loc.n;
			console.log("save mapName - size "+map.w+"x"+map.h);
			window.localStorage.setItem('map',mapName);
		}
		else calibrate();
		/*
		{
			id('coordsHeader').innerHTML="NW reference point";
			id('easting').value='';
			id('northing').value='';
			status=0;
			id('coordsDialog').style.display='block';
		}
		*/
  	});
  	fileReader.readAsDataURL(file);
},false);

function calibrate() {
	id('coordsHeader').innerHTML="NW reference point";
	id('easting').value='';
	id('northing').value='';
	status=0;
	id('coordsDialog').style.display='block';
}

id("quadrantChooser").addEventListener('change', function() { // LOAD MAP QUADRANT IMAGE
	var file = id('quadrantChooser').files[0];
	console.log(quadrant+" quadrant: "+file+" name: "+file.name);
	var quadrantName=file.name;
	var fileReader=new FileReader();
	fileReader.addEventListener('load', function(evt) {
		mapQuadrant=new Image();
		mapQuadrant.onload=function() {
			console.log('quadrant size: '+mapQuadrant.width+"x"+mapQuadrant.height);
			mapBuilder();
		}
		mapQuadrant.src=evt.target.result;
  	});
  	fileReader.readAsDataURL(file);
},false);

id('cancelBuild').addEventListener('click',function() {
	id('mapBuilderDialog').style.display='none';
	id('mapCanvas').width=screen.width;
	id('mapCanvas').height=screen.height;
})

dist=distance=0;
sw=window.innerWidth;
sh=window.innerHeight;
centre.x=sw/2;
centre.y=sh/2;
console.log("centre at "+centre.x+","+centre.y);
breadcrumb.src="breadcrumb.svg";
id("mapHolder").style.width = sw+'px';
id("mapHolder").style.height = sh+'px';
mapCanvas=id("mapCanvas").getContext("2d"); // set up drawing canvas
id("mapCanvas").width=sw;
id("mapCanvas").height=sh;
var json=window.localStorage.getItem('track');
if(json) {
	notify('track loaded: '+json);
	track=JSON.parse(json);
	distance=0;
	for(var i=1;i<track.length;i++) {
		distance+=measure('distance',track[i],track[i-1]);
	}
}
else notify('no track saved');
anchor={};
id("actionButton").style.left=(sw-70)+'px';
id("actionButton").style.top=(sh-70)+'px';
console.log("action button moved!");
id("actionButton").style.display='block';
id("map").style.display = 'block';
redraw();
id('actionButton').style.display='none';
if(sw<800) { // phone - remove 'build map' menu option and proceed to choose a map
 	var opt=id('buildMap');
	opt.parentNode.removeChild(opt);
	id('mapDialog').style.display='block';
}
else id('menu').style.display='block'; // chromebook - show menu

function startMove(event) {
	id('menu').style.display='none';
	var touches=event.changedTouches;
	x0=touches[0].clientX;
	y0=touches[0].clientY;
}
	
function move(event) {
	id('menu').style.display='none';
	if(!tracking) {
		var touches=event.changedTouches;
		x=touches[0].clientX;
		y=touches[0].clientY;
		// console.log("drag by "+x+"x"+y+"px");
		mapX+=(x-x0);
		mapY+=(y-y0);
		// console.log('map at '+mapX+','+mapY);
		id('mapHolder').style.left=mapX+'px';
		id('mapHolder').style.top=mapY+'px';
		x0=x;
		y0=y;
		if(map.xScale>0) { // once map is calibrated, adjust and display coords
			x=centre.x-mapX;
			y=centre.y-mapY;
			loc.e=Math.round(map.e+x*map.xScale*zoom);
			loc.n=Math.round(map.n-y*map.yScale*zoom);
			id('heading').innerHTML=loc.e+' '+loc.n;
		}
		if(track.length>0) redraw();
		console.log('lat: '+loc.n+' mapY: '+mapY+'map.n: '+map.n+' yScale: '+map.yScale+" centre.y: "+centre.y);
	}
//	else notify('tracking - no drag');
}
	
function go() { // start tracking location
	tracking=true;
	notify("start tracking");
	fix=0;
	fixes=[];
	if (navigator.geolocation) {
		var opt={enableHighAccuracy: true, timeout: 15000, maximumAge: 0};
        	geolocator = navigator.geolocation.watchPosition(sampleLocation, locationError, opt);
    } else  {
    	alert("Geolocation is not supported by this browser.");
    }
	document.getElementById("actionButton").innerHTML='<img src="stopButton24px.svg"/>';
	document.getElementById("actionButton").removeEventListener("click", go);
	document.getElementById("actionButton").addEventListener("click", cease);
	/* test BNG conversion using values in OS document
	console.log("convert 52*39'27.2531N, 1*43'4.5177W to BNG");
	lat=52.6575703;
	lon=1.71792158;
	bng();
	*/
}

function sampleLocation(position) {
	var accuracy=position.coords.accuracy;
	if(accuracy>50) return; // skip inaccurate fixes
	fixes[fix]={};
	fixes[fix].lon=position.coords.longitude;
	fixes[fix].lat=position.coords.latitude;
	fixes[fix].alt=position.coords.altitude;
	fix++;
	if(fix<3) return;
	fix=0; // reset to get next three sample fixes
	lon=(fixes[0].lon+fixes[1].lon+fixes[2].lon)/3; // average location data
	lat=(fixes[0].lat+fixes[1].lat+fixes[2].lat)/3;
	bng(); // convert lat/lon to BNG coords and set loc.e, loc.n
	notify('fix at '+loc.e+" "+loc.n);
	if(track.length<1) { // at start, initialise lastLoc and...
		lastLoc.e = loc.e;
		lastLoc.n = loc.n;
		addTP(); // ...add first trackpoint
	}
	else {
		dist = measure("distance",loc,lastLoc); // distance since last averaged fix
		notify('moved '+decimal(dist,1)+"m");
	}
	lastLoc.e = loc.e;
	lastLoc.n = loc.n;
	var t=track.length-1; // most recent trackpoint
	dist=measure("distance",loc,track[t]); // distance since last trackpoint
	var direction=measure("heading",track[t],loc); // heading since last trackpoint
	var turn=Math.abs(direction-heading);
	if(turn>180) turn=360-turn;
	if((dist>50)||(turn>30)) { // add trackpoint every 50m or when direction changes > 30*
		distance+=dist;
		heading=Math.round(direction);
		addTP();
		dist=0;
	}
	x=(loc.e-map.e)/(map.xScale*zoom);
	y=(map.n-loc.n)/(map.yScale*zoom);
	mapX=centre.x-x;
	mapY=centre.y-y;
	notify("moving to "+loc.e+","+loc.n+"("+mapX+","+mapY);
	id('mapHolder').style.left=mapX+'px';
	id('mapHolder').style.top=mapY+'px';
	id('heading').innerHTML=loc.e+' '+loc.n;
	if(track.length>0) redraw();
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
	
function addTP() {
	notify("add trackpoint at "+loc.e+" "+loc.n+" total: "+track.length);
	var tp={};
	tp.e=loc.e;
	tp.n=loc.n;
	track.push(tp);
	redraw();
}
	
function cease(event) {
	notify("CEASE track length is "+track.length+" trackpoints");
	if(track.length>1) {
		notify('save track: '+track.length+" trackpoints");
		var json=JSON.stringify(track);
		window.localStorage.setItem('track',json);
		notify('track saved');
	}
	navigator.geolocation.clearWatch(geolocator);
	tracking=false;
	id("actionButton").innerHTML='<img src="goButton24px.svg"/>';
	id("actionButton").removeEventListener("click", cease);
	id("actionButton").addEventListener("click", go);
	// document.getElementById("heading").innerHTML = "White Peak";
	redraw();
}

function redraw() {
	var i, p, x, y, r, d, t;
	notify("redraw - tracking is "+tracking);
	mapCanvas.clearRect(0,0,sw,sh);
	if(track.length>0) {
		notify("draw "+track.length+" trackpoints");
	    for(i=1;i<track.length;i++) {
	    	p=track[i];
	    	x=(p.e-map.e)/(map.xScale*zoom)+mapX;
	    	y=(map.n-p.n)/(map.yScale*zoom)+mapY
	    	// mapCanvas.fillRect(x-2,y-2,4,4);
	    	mapCanvas.drawImage(breadcrumb,x-5,y-5);
	    }
	}
	console.log("draw cross");
	mapCanvas.lineWidth=5;
	mapCanvas.strokeStyle='rgba(0,0,255,0.75)';
	mapCanvas.beginPath();
	mapCanvas.moveTo(centre.x-20,centre.y); // blue cross at current location
	mapCanvas.lineTo(centre.x-5,centre.y);
	mapCanvas.moveTo(centre.x+5,centre.y);
	mapCanvas.lineTo(centre.x+20,centre.y);
	mapCanvas.moveTo(centre.x,centre.y-20);
	mapCanvas.lineTo(centre.x,centre.y-5);
	mapCanvas.moveTo(centre.x,centre.y+5);
	mapCanvas.lineTo(centre.x,centre.y+20);
	mapCanvas.stroke();
	notify('draw distance');
	if(distance>0) {
		mapCanvas.fillStyle='blue';
		mapCanvas.textBaseline='baseline';
		mapCanvas.font='Bold 24px Sans-Serif';
		d=Math.round(distance+dist);
		if(d<1000) d+="m";
		else d=decimal(d/1000)+"km";
		mapCanvas.fillText(d,5,sh-20);
	}
}

function mapBuilder() {
	id('menu').style.display='none';
	// id('buildName').disabled=true;
	// id('saveBuild').disabled='true';
	id('mapBuilderDialog').style.display='block';
	id('quadrant').innerHTML='select <big>'+quadrant+'</big> quadrant';
	switch(quadrant) {
		case 'NW':
			var w=mapQuadrant.width;
			var h=mapQuadrant.height;
			anchor.x=w;
			anchor.y=h;
			console.log("quadrant "+quadrant+" size: "+w+" x "+h);
			id('mapCanvas').width=2*w;
			id('mapCanvas').height=2*h;
			console.log('built map size: '+id('mapCanvas').width+"x"+id('mapCanvas').height);
			mapCanvas.drawImage(mapQuadrant,0,0);
			quadrant='NE';
			id('quadrant').innerHTML='select <big>'+quadrant+'</big> quadrant';
			break;
		case 'NE':
			var w=mapQuadrant.width;
			var h=mapQuadrant.height;
			console.log('NE quadrant: '+w+"x"+h);
			mapCanvas.drawImage(mapQuadrant,anchor.x,anchor.y-h);
			quadrant='SW';
			id('quadrant').innerHTML='select <big>'+quadrant+'</big> quadrant';
			break;
		case 'SW':
			var w=mapQuadrant.width;
			var h=mapQuadrant.height;
			console.log('SW quadrant: '+w+"x"+h);
			mapCanvas.drawImage(mapQuadrant,anchor.x-w,anchor.y);
			quadrant='SE';
			id('quadrant').innerHTML='select <big>'+quadrant+'</big> quadrant';
			break;
		case 'SE':
			var w=mapQuadrant.width;
			var h=mapQuadrant.height;
			console.log('SE quadrant: '+w+"x"+h);
			mapCanvas.drawImage(mapQuadrant,anchor.x,anchor.y);
			id('quadrantChooser').disabled=true;
			id('quadrant').innerHTML="<big>save image as new map file</big>";
			var canvas=id('mapCanvas');
			var imageURL=canvas.toDataURL();
			console.log('image data ready');
			id('builtMap').src=imageURL;
			console.log('save image');
	};
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
		loc.n=Math.round(v1+v2*dq2+v3*dq4+v4*dq6);
		loc.e=Math.round(e0+v5*dq+v6*dq3+v7*dq5);
		console.log("fix is at BNG "+loc.e+" "+loc.n);	
	}
	
	function measure(type,pt1,pt2) {
		var dx = pt2.e-pt1.e;
	    var dy = pt2.n-pt1.n;
		if(type=="distance") return Math.sqrt(dx*dx+dy*dy);
		var h; // heading
		if(dy==0) {
	        h=(dx>0)?90:270;
	    }
	    else {
	        h=Math.atan(dx/dy)*180 / Math.PI;
	        if(dy<0) h+=180;
	        if(h<0) h+=360 // range 0-360
        }
        return h;
	}
	
	function decimal(n) {
	    return Math.floor(n * 10 + 0.5) / 10;
	}
	
	function notify(note) {
		notifications.push(note);
		while(notifications.length>20) notifications.shift();
		console.log(note);
	}
	
	function showNotifications() {
		id('menu').style.display='none';
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
