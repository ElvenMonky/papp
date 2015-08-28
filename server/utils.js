module.exports = {
    error: function(res, message) {
        if (res)
            return res.jsonp({"status": -1, "status_message": message});
        else
            return console.log("Error: " + message);
    },

    start: function(message) {
        console.log(message);
        return Date.now();
    },

    finish: function(message, started) {
        console.log(message + " in " + (Date.now() - started) + " ms");
    },

    log: function(message) {
        console.log(message);
    }
}