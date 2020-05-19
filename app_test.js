const fetch = require("node-fetch");

const doRequest = (url, request) => {
    fetch(url, request)
    .then(res => {
        if (res.ok || res.status === 500) {
            return res.json();
        }
        throw res;
    })
    .then(resJson => {
        if (!resJson.success)
            throw resJson;
        else
            console.log(resJson);
    })
    .catch(error => {
        console.log('Error: ' + (error.statusText || error.message));
    });
}

const testLogin = (user, pass) => {
    console.log('Logging on user ' + user + ', password ' + pass);
    doRequest('http://localhost:5000/api/v1/auth/', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({
            name: user,
            password: pass
        })
    })

}

const testSetPassword = (user, old_pass, new_pass) => {
    console.log('Changing password for user ' + user + ' to ' + new_pass);
    doRequest('http://localhost:5000/api/v1/psw/', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({
            name: user,
            password: old_pass,
            new_password: new_pass
        })
    })

}

//testLogin('1', '1');
//testLogin('1', '2');
//testLogin('2', '2');

//testSetPassword('1', '1', '2');
testSetPassword('1', '1', '2');

