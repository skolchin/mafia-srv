const fetch = require("node-fetch");

const doRequest = (api, request) => {
    fetch('http://localhost:5000' + api, request)
    .then(res => {
        if (res.ok) {
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
    doRequest('/api/v1/auth/', {
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
    doRequest('/api/v1/psw/', {
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

const testGames = (user_id) => {
    console.log('Listing games for user ' + user_id);
    doRequest('/api/v1/games?user_id=' + user_id)
}

const testAddGame = (user_id, user_name) => {
    console.log('Adding game for user ' + user_id);
    doRequest('/api/v1/new_game', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({
            name: '<New game>',
            leader_id: user_id,
            leader_name: user_name,
        })
    })
}

testLogin('1', '1');
testLogin('1', '2');
//testLogin('2', '2');

//testAddGame('5ec182dc01845ef21761e699', 'kol');
testGames('5ec182dc01845ef21761e699');

//testSetPassword('1', '1', '2');
//testSetPassword('1', '1', '2');

