module.exports = class User {
    #connection;
    #id;

	static users = [];
    static #nextId = 1;

	get connection() { return this.#connection; }
    get id() { return this.#id; }

    constructor(connection) {
        this.#connection = connection;
        this.#id = User.#nextId;
        User.#nextId++;	
		this.#login(); // User can't exist without being logged in
    }

	#login() {
		User.users.push(this);

		globals.onLogin(this);

		this.#connection.off("login");
		this.#connection.on("data", data => globals.onData(this, data));
		this.#connection.on("logout", () => this.logout());
		this.#connection.on('disconnect', () => this.logout());
		this.#connection.join("users");

		this.#connection.alert({ msg: "Authorized", type: "info" });
		this.#connection.emit("authorized");
		print(`Web-CLI user has logged in. User-ID: ${this.id} (Connection-ID: ${this.#connection.id})`);
	}

	logout() {
		User.users.splice(User.users.indexOf(this), 1); // Remove user from memory.
		
		globals.onLogout(this);
		
		this.#connection.off("data");
		this.#connection.off("logout");
		this.#connection.leave("users");
		this.#connection.on("login", data => User.tryLogin(this.#connection, data));

		this.#connection.alert({msg:"Logged out", type:"info"});
		print(`Web-CLI user has (been) logged out. User-ID: ${this.id} (Connection-ID: ${this.#connection.id})`);
	}

	send(message) {
		this.#connection.send(message);
	}

	// sendPrompt() {
	// 	const promise = new Promise(() => {

	// 	});
	// }

	static tryLogin(connection, data) {
		if(connection.blocked) {
			return;
		} else if(data === settings.password) {
			if (User.users.length >= settings.maxAllowedUsers) {
				connection.alert({ msg:'Web-CLI is occupied. No access available.', type:'warn' });
				print(`Web-CLI is occupied. Correct login was blocked. (Connection-ID: ${connection.id})`);
				return;
			}
			var user = new User(connection);
			globals.onLogin(user);
		} else if(connection.attempts >= settings.maxAllowedAttempts) {
			connection.blocked = true;
			setTimeout(async function () { delete connection.blocked; }, 180000);
			connection.alert({ msg:`Too many failed login attempts. Timed out for ${/*settings.timeout*/ 180000/1000/60} minute(s).`, type:'error' });
			print(`${connection.attempts} failed login attempts made. (Connection-ID ${connection.id})`);
			connection.attempts = 0;
		} else {
			connection.alert({ msg:`Password is incorrect`, type:'error' });
			connection.attempts++;
		}
	}

	#getUserFromConnection(connection) {
		return User.users.find(user => connection === user.connection);
	}

	#connectionIsUser(connection) {
		return !!User.users.find(user => connection === user.connection);
	}
}

var globals = require('../globals.js');
var settings = require('../settings.js');

const print = globals.print;