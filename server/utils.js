var loaded = Date.now();
module.exports = {
    error: function(res, message) {
        if (res)
            return res.jsonp({"status": -1, "status_message": message});
        else
            return console.log("Error: " + message);
    },

    start: function(message) {
        module.exports.log(message);
        return Date.now();
    },

    finish: function(message, started) {
        module.exports.log(message + " in " + (Date.now() - started) + " ms");
    },

    log: function(message) {
        console.log((Date.now() - loaded) + ": " + message);
    }
}