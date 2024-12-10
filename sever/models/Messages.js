const mongoose = require('mongoose')

const messageShema = mongoose.Schema({
    conversationId:{
        type:String,
    },
    senderId:{
        type:String,
    },
    message:{
        type:String,
    }
});
 
const Messages = mongoose.model('Message',messageShema);

module.exports = Messages;