"use strict"		// avoid bugs

//------------------------------------------------the real shit---------------------------------------------

function Player(){
	this.accelerate = function( acceleration ){				// accelerate by given acceleration
		this.accelerateV({
			x: Math.sin( this.children.human.body.rotation.y ),
			y: 0,
			z: Math.cos( this.children.human.body.rotation.y )
		}, acceleration );
	}
	this.accelerateV = function( vector, multiplier = 1 ){	// accelerate by a given vector
		this.velocity.add( new THREE.Vector3().copy( vector ).multiplyScalar( multiplier ) );
	}
	this.move = function(deltaTime){		// move
		this.position.add( new THREE.Vector3().copy( this.velocity ).multiplyScalar( deltaTime ) );
		this.children.human.body.position.copy( this.position );
	}
	this.applyFriction = function(deltaTime, friction = this.friction, minspeed = 0.01){
		this.accelerateV(this.velocity, -friction * deltaTime);
		if( this.velocity.length() < minspeed ) this.velocity.set(0,0,0);				// avoid unnessary calcs
	}
	this.applyGravity = function(deltaTime){
		this.accelerateV({ x: 0, y: -this.gravity * deltaTime, z: 0});
	}
	this.jump = function(){				// jump by the velocity of jumpForce

		if(this.position.y <= this.height){
			this.accelerateV({ x: 0, y: this.jumpForce, z: 0});
			console.log("jump: " + this.jumpForce);
		}
	}
	this.isActive = function() {
		return this === player.active;
	}
	this.update = function( deltaTime ){			// called every frame, deltaTime in s
		if(input.left && this.isActive()) this.children.human.body.rotation.y += deltaTime * this.rotationSpeed;
		if(input.right && this.isActive()) this.children.human.body.rotation.y -= deltaTime * this.rotationSpeed;

		if ( this.position.y > this.height ){			// check if player is above ground
			this.applyGravity( deltaTime );
		} else {
			if(input.up && this.isActive()) this.accelerate( -deltaTime * this.acceleration );
			if(input.down && this.isActive()) this.accelerate( deltaTime * this.acceleration );

			if(this.velocity.x || this.velocity.z){
				this.applyFriction( deltaTime );
			}
		}
		if( this.velocity.length() ){			// only updatePos when moving
			this.move( deltaTime );			// update position based on velocity and time
		}
		if( this.position.y <= this.height ){			// crappy ground 'collision' check
			this.velocity.y = 0;
			this.position.y = this.height;
		}

		//console.log("velocity: " + this.velocity.length());
		//console.log("rotation: " + this.rotation.y);
		//console.log("position: " + this.position.x + " - " + this.position.y + " - " + this.position.z)


		// move arms back and forth
		if ( toPositive( this.armDanglePos ) > 1 ){
			this.armDanglePos = this.armDanglePos > 0 ? 1 : -1;
			this.armDangleSpeed *= -1;
		}
		this.armDanglePos += this.armDangleSpeed * deltaTime * this.velocity.length() / 2;

		this.children.human.arm.left.rotation.x = this.armDanglePos;
		this.children.human.forearm.left.rotation.x = this.armDanglePos + 1;
		this.children.human.arm.right.rotation.x = -this.armDanglePos;
		this.children.human.forearm.right.rotation.x = -this.armDanglePos + 1;
	}

	this.children = {};

	this.color = randomColor();
	this.children.human = { body: {}, arm: {}, forearm: {}, leg: {} };
	scene.add( newHumanMesh( this.children.human ) );
	this.height = 1;			// in m
	this.acceleration = 2;		// in m/s²
	this.jumpForce = 5;		// in m/s² at start of jump
	this.gravity = 10;			// in m/s² downward acceleration when above this.height
	this.rotationSpeed = 1.5;			// in radians / s
	this.friction = 0.4;				// in 100% / s
	this.position = new THREE.Vector3( 0, this.height );			// in m
	this.rotating = false;
	this.velocity = new THREE.Vector3();			// in m/s
	this.armDangleSpeed = 1					// speed of the arms moving back and forth
	this.armDanglePos = 0;
}


function objectList(){

	// list storing the collision relevant objects
	this.object = {};

	// add given object to the list (this.object) and return the the position in the object list
	this.add = function(object){
		if( object && object.uuid ) this.object[object.uuid] = object;
		else console.warn( "the given object (" + object + ") does not have an uuid and thus cannot be added")
	}

	// remove object from object list using the position of the object in the object list
	this.remove = function(uuid){
		if( this.object[uuid] ) this.object[uuid] = null;
		else console.warn( "cannot remove object with uuid " + uuid + ": it already doesn't exist" );
	}

	// check if an object can move forward the given vector and return the if needed adjusted vector
	this.collision = function( uuid, velocityVector, deltaTime ){

		// return if uuid isn't valid
		if( !uuid || !this.object[uuid] ){
			console.warn( "collision cannot be checked: no object with uuid " + uuid );
			return;
		}

		// create variables based on input
		var returnObj = {};
		returnObj.velocityVector = new THREE.Vector3().copy( velocityVector );
		returnObj.moveVector = new THREE.Vector3().copy( velocityVector ).multiplyScalar( deltaTime );

		// check input object against other objects
		for ( var object in this.object ){
			if ( this.object[object] && this.object[object] != this.object[uuid] ){

				var dist1 = new THREE.Vector3().subVectors( this.object[object].position, this.object[uuid].position );

				var dist2 = new THREE.Vector3().subVectors( dist1, returnObj.moveVector );

				// law of cosines
				var alpha = Math.acos(
					( returnObj.moveVector.length()*returnObj.moveVector.length() + dist1.length()*dist1.length() - 
						dist2.length()*dist2.length() ) / 
					2 * returnObj.moveVector.length() * dist1.length());

				var gamma = Math.asin( dist1.length() * Math.sin(alpha) / dist2.length() );

				var h = dist1.length() * Math.sin(alpha);

				// shortest distance from the velocity vector to the other object
				var shortestDist = gamma < Math.PI ? h : dist2.length();

				// test only - all objects are spheres with a radius = 1
				var r1 = 1, r2 = 1;
				var r = r1 + r2;

				// debug only
				//console.log( shortestDist );
 
				// stuff to calculate, when a there is an upcoming collision detected
				if( shortestDist <= r ){
					var gamma2 = Math.asin( Math.sin(alpha) * dist1.length() / r );
					var beta2 = 180 - alpha - gamma2;

					// "new v1"
					var moveVector2Length = r * Math.sin(beta2) / Math.sin(alpha);
					var moveVector2 = new THREE.Vector3().copy( returnObj.moveVector )
						.multiply( moveVector2Length / returnObj.moveVector.length() );

					// "Ziel1"
					var aim1 = new THREE.Vector3().addVectors( this.object[uuid].position, moveVector2 );

					// "dist3 vector"
					var dist3vector = new THREE.Vector3().subVectors( this.object[object].position, aim1 );

					// alpha2
					var alpha2 = 180 - gamma2;

					// "v2"
					var moveVector3Length = (returnObj.moveVector.length() - moveVector2Length) * Math.sin(alpha2);
					var moveVector3 = new THREE.Vector3();
					if(moveVector3Length != 0){
						console.log( "collision -> new velocity velocityVector" );
						moveVector3.copy( dist3vector );
						var normalVectorForRotation;
						// rotate
					}

					//...
				}
			}
		}

		return returnObj;
	}
}

//swap negative numbers
function toPositive(input){
	return input < 0 ? -input : input;
}

// return a random color: "#xxxxxx"
function randomColor(){
	var chars = '0123456789abcdef'
	var value = '#';
	for(var i=0; i < 6; i++){
		value += chars[Math.floor(Math.random() * 16)];
	}
	return value;
}

// function to create a new object which checks the time between two calls in ms
function deltaTimeCreate(){
	this.fullTime = new Date().getTime();
	this.time = 0;
	this.new = function(){
		this.time = new Date().getTime() - this.fullTime;
		this.fullTime += this.time;
	}
}

function entityList(){
	this.number = [];
	this.set = function(number) {
		if(!this.number[number]){
			this.number[number] = new Player();
			collisionObjects.add( this.number[number].children.human.body );
		}
		this.active = this.number[number];	
	}
	this.set(0);
}

// create an child pointing to the given object
function makePointer( obj, pointerObj, childName){
	pointerObj[childName] = obj;
	return obj;
}

// copy properties of obj2 to obj1
function mergeObjects(obj1, obj2){
	for (var thing in obj2){
		if ( typeof obj2[thing] === "object" ){
			if( typeof obj1[thing] === "object" ) mergeObjects( obj1[thing], obj2[thing] );
			else console.warn( "object property " + thing + " couldn't be merged");
		}
		else obj1[thing] = obj2[thing];
	}
}

function newMesh(type, geometry = [], material = {}, other = {}){		// test standard sphere creator func("",[],{},{})

	// standard values
	var standard = {
		all: {
			material: {  },
			other: { receiveShadow: true, castShadow: true }
		},
		BoxGeometry: {
			geometry: [ 1, 1, 1 ],
		},
		SphereGeometry: {
			geometry: [ 0.2, 5, 5 ],
		},
		ConeGeometry: {
			geometry: [ 1, 1 ],
		},
		CylinderGeometry: {
			geometry: [ 1, 1, 1 ],
		},
		PlaneGeometry: {
			geometry: [ 1, 1 ],
		},
		TorusGeometry: {
			geometry: [ 1, 0.5 ],
		}
	};

	// merge input and standard values
	if ( standard[type] ){
		for (var i = standard[type].geometry.length - 1; i >= 0; i--) {
			if ( typeof geometry[i] === "undefined" ) geometry[i] = standard[type].geometry[i];
		}
		for ( var thing in standard[type].material ){
			if ( typeof material[thing] === "undefined" ) material[thing] = standard[type].material[thing];
		}
		for ( var thing in standard[type].other ){
			if ( typeof other[thing] === "undefined" ) other[thing] = standard[type].other[thing];
		}
	}
	// merge input and standard.all values
	for ( var thing in standard.all.material ){
		if ( typeof material[thing] === "undefined" ) material[thing] = standard.all.material[thing];
	}
	for ( var thing in standard.all.other ){
		if ( typeof other[thing] === "undefined" ) other[thing] = standard.all.other[thing];
	}

	// prepare return object
	if(THREE[type]){
		var returnObj = new THREE.Mesh( 
			new THREE[type]( ...geometry ),				// only works in new browsers
			new THREE.MeshStandardMaterial( material )
		);
		mergeObjects(returnObj, other);
		
		return returnObj;
	} else {
		console.warn("THREE[" + type + "] not found -> no object created");
	}
}

function newGroup(values){

	var returnObj = new THREE.Group();
	mergeObjects(returnObj, values);
	return returnObj;
}

function newLight( create = [ "#ffffff", 1, 10 ], values ){			// create a spot light

	//create light with standard values
	var returnObj = new THREE.SpotLight( ...create );				// only works in new browsers
	returnObj.castShadow = true;

	//set values
	mergeObjects( returnObj, values );
	return returnObj;
}

function newCamera( create = [], values = {} ){

	// standard create values
	var standard = {
		create: [ 50, window.innerWidth / window.innerHeight, 0.1, 1000 ]
	};

	// merge standard and input create values
	for ( var thing in standard.create ){
		if ( typeof create[thing] === "undefined" ) create[thing] = standard.create[thing];
	}

	// create return object
	var returnObj = new THREE.PerspectiveCamera( ...create );				// only works in new browsers

	// merge input values into the return object
	mergeObjects(returnObj, values);

	return returnObj;
}

function newHumanMesh( pointerObj ){			// create a human like looking group object
	var returnObj = 
		makePointer( newGroup({ position: { y: 1 } }).add(

			// head
			makePointer( newGroup({ position: { y: 0.8 } }).add(
				newMesh( "SphereGeometry", [ 0.2, 10, 10 ]),
				makePointer(
					newCamera( [], { position: { z: -0.2 } } ),
					pointerObj, "camera"
				)
				//new THREE.SpotLight( randomColor(), 1, 10 )
			), pointerObj, "head" ),

			// the rest of the body
			newGroup({ position: { y: 0.2 } }).add(

				// body
				newMesh( "BoxGeometry", [ 0.6, 0.8, 0.3 ]),

				// arms
				makePointer( newGroup({ position: { x: 0.4, y: 0.3 }
				} ).add(
					newMesh( "CylinderGeometry", [0.1, 0.1, 0.1, 20], {}, { 
						rotation: { z: Math.PI / 2 },
						position: { x: -0.05 }
					} ),
					newMesh( "SphereGeometry", [ 0.1, 20, 20 ]),
					newMesh( "CylinderGeometry", [0.1, 0.1, 0.4, 20], {}, { position: { y: -0.2 } } ),
					makePointer( newGroup({ position: { y: -0.4 } }).add(
						newMesh( "SphereGeometry", [ 0.1, 20, 20 ] ),
						newMesh( "CylinderGeometry", [0.1, 0.1, 0.4, 20], {}, { position: { y: -0.2 } } )
					), pointerObj.forearm, "right")
				), pointerObj.arm, "right" ),

				makePointer( newGroup({ position: { x: -0.4, y: 0.3 }
				} ).add(
					newMesh( "CylinderGeometry", [0.1, 0.1, 0.1, 20], {}, { 
						rotation: { z: Math.PI / 2 },
						position: { x: 0.05 }
					} ),
					newMesh( "SphereGeometry", [ 0.1, 20, 20 ]),
					newMesh( "CylinderGeometry", [0.1, 0.1, 0.4, 20], {}, { position: { y: -0.2 } } ),
					makePointer( newGroup({ position: { y: -0.4 } }).add(
						newMesh( "SphereGeometry", [ 0.1, 20, 20 ] ),
						newMesh( "CylinderGeometry", [0.1, 0.1, 0.4, 20], {}, { position: { y: -0.2 } } )
					), pointerObj.forearm, "left" )
				), pointerObj.arm, "left" ),

				// legs
				makePointer(
					newMesh( "CylinderGeometry", [0.13, 0.13, 0.8], {}, { position: { x: 0.17, y: -0.8 } } ),
					pointerObj.leg, "right"
				),

				makePointer(
					newMesh( "CylinderGeometry", [0.13, 0.13, 0.8], {}, { position: { x: -0.17, y: -0.8 } } ),
					pointerObj.leg, "left"
				)
			)
		), pointerObj, "body");

	return returnObj;
}

function rotateView( x, y ){			// turn head/camera based on mouse input
	// left/right -> turn head
	player.active.children.human.head.rotation.y += (x - input.mousedownPos.x) / 100;
	// up/down -> turn camera
	player.active.children.human.camera.rotation.x += (y - input.mousedownPos.y) / 100;
	// set saved mouse position to last input value
	input.mousedownPos = { x: x, y: y };
}

//------------------------------------------------------basic---------------------------------------------------

function init(){

	window.scene = new THREE.Scene();

	window.collisionObjects = new objectList();

	window.player = new entityList();

	// set up renderer with soft shadows enabled
	window.renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );

	// sun-like light
	scene.add( newLight( [ "#ffffff", 2, 100], { 
		shadow: { mapSize: { width: 4096, height: 4096 } },
		position: { y: 10 },
		angle: 1.5
	}));

	// ground
	var geometry = new THREE.BoxGeometry( 100, 2, 100 );
	var material = new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0.5, metalness: 0.1 } );
	var ground = new THREE.Mesh( geometry, material );
	ground.receiveShadow = true;
	ground.position.y = -1;
	scene.add( ground );

	// create deltaTIme object
	window.deltaTime = new deltaTimeCreate();

	// input variables, true when key down
	window.input = {
		left: false,
		right: false,
		up: false,
		down: false,
		mousedown: false,
		mousedownPos: { x: 0, y: 0 }
	};

	// resize window / reload
	window.addEventListener( 'resize', resize );

	// test only - spinning multi-object
	window.testObj1 = 
		newGroup({ position: { y: 1, z: -5 }, update: function(){this.rotation.y+=0.1}} ).add(
			newMesh( "BoxGeometry", [], { color: "#ffffff" } ),
			newMesh( "SphereGeometry", [0.7,10,10], { color: "#ffff00"}, { position: { x:  1 } } ),
			newMesh( "SphereGeometry", [0.7,10,10], { color: "#00ffff"}, { position: { x: -1 } } )
		);
	scene.add( testObj1 );
	// test only - collision object list
	collisionObjects.add( testObj1 );
	
	// test only - a wall
	var wall = newMesh( "BoxGeometry", [10, 10, 1], {}, { position: { x: 10, y: 5, z: 10 }});
	scene.add( wall );
	collisionObjects.add( wall );

	
	render();
}

function resize(){
	stop();
	init();	
}

function stop(){
	scene  = null;
	player = null;
	document.body.removeChild( renderer.domElement );
	renderer = null;
	deltaTime = null;
	input = null;
	window.removeEventListener( 'keydown', resize );
	cancelAnimationFrame( request );
} 


window.onkeydown = function(e){
	var key = e.keyCode ? e.keyCode : e.which;
	//console.log("key down: " + key);
	switch(key){
		case 65: input.left = true; break;			//left
		case 68: input.right = true; break;			//right
		case 87: input.up = true; break;			//up
		case 83: input.down = true; break;			//down
		case 32: player.active.jump(); break;			// space
		case 48:
		case 49:
		case 50:
		case 51:
		case 52:
		case 53:
		case 54:
		case 55:
		case 56:
		case 57: player.set(key - 48); break;			// change player
	}
}
window.onkeyup = function(e){
	var key = e.keyCode ? e.keyCode : e.which;
	switch(key){
		case 65: input.left = false; break;			//left
		case 68: input.right = false; break;		//right
		case 87: input.up = false; break;			//up
		case 83: input.down = false; break;			//down
	}
}
window.onmousedown = function(e){
	input.mousedown = true;
	input.mousedownPos = { x: e.clientX, y: e.clientY };
}
window.onmousemove = function(e){
	if(input.mousedown){
		rotateView( e.clientX, e.clientY );
	}
}
window.onmouseup = function(e){
	input.mousedown = false;
	rotateView( e.clientX, e.clientY );
}

function render() {

	// test only - spinning multi-object
	testObj1.update();

	// update current delta time (deltaTim.time)
	deltaTime.new();

	// calcTime...

	// debug: lag detection
	if(deltaTime.time > 150) console.warn("deltaTime: " + deltaTime.time);

	// test only - collision
	collisionObjects.collision( player.active.children.human.body.uuid, player.active.velocity, deltaTime.time / 1000 );

	// update all players
	for( var i=0; i < player.number.length; i++ ){
		if( player.number[i] ) player.number[i].update( deltaTime.time / 1000 );
	}

	window.request = requestAnimationFrame( render );
	renderer.render( scene, player.active.children.human.camera );
}
