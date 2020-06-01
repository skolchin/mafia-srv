const fetch = require("node-fetch");

const doRequest = (api, options, token=null, callback=null) => {
    const authHeader = token ? { 'Authorization': token} : {};
    const headers = {...options, ...authHeader};
    console.log('--> Request url: ' + api);
    console.log('--> Request headers:');
    console.log(headers);
    fetch('http://localhost:5000' + api, headers)
    .then(res => {
        console.log('--> Response headers:');
        console.log(res.headers);
        if (res.ok) {
            return res.json();
        }
        throw res;
    })
    .then(resJson => {
        if (!resJson.success)
            throw resJson;
        else {
            console.log(JSON.stringify(resJson, null, 2));
            if (callback) callback(resJson);
        };
    })
    .catch(error => {
        console.log('Error: ' + (error.statusText || error.message));
    });
}

const testLogin = (user, pass, callback=null) => {
    console.log('Logging on user ' + user + ', password ' + pass);
    doRequest('/api/v1/auth/', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({
            name: user,
            password: pass,
//            withGames: true,
        }),
    }, null, callback)
}

const testSetPassword = (user, new_pass, token=null, callback=null) => {
    console.log('Changing password for user ' + user + ' to ' + new_pass);
    doRequest('/api/v1/psw/', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "same-origin",
        body: JSON.stringify({
            name: user,
            new_password: new_pass
        })
    }, token, callback)
}
const testSetPasswordCbf = (new_pass, callback=null) => {
    return (resJson) => testSetPassword(resJson.data.user._id, new_pass, resJson.token, callback)
};

const testListGames = (user_id, token=null, callback=null) => {
    console.log('Listing games for user ' + user_id);
    doRequest('/api/v1/games?user_id=' + user_id, {method: 'GET', credentials: "same-origin"}, token, callback);
}
const testListGamesCb = (resJson) => {
    testListGames(resJson.data.user._id, resJson.token);
}

const testGetGame = (game_id) => {
    console.log('Getting game ' + game_id);
    doRequest('/api/v1/game?_id=' + game_id)
}

const testAddGame = (user_id, user_name, token=null, callback=null) => {
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
    }, token, callback)
}

//testLogin('1', '1');
//testLogin('1', '1', testListGamesCb);
testLogin('1', '1', testSetPasswordCbf('2'));
//testLogin('1', '2');
//testLogin('2', '2');
//testLogin('1', '1', testListGamesCb);


//testAddGame('5ec182dc01845ef21761e699', 'kol');
//testListGames('5ec92b1b04eefb2a8406aaec');
//testGetGame('5eca4a1e8c65911bb830956b')

//testSetPassword('1', '1', '2');
//testSetPassword('1', '1', '2');


