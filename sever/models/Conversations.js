const mongoose = require('mongoose')

const conversationShema = mongoose.Schema({
    members:{
        type:Array,
        require:true,
    }
});
 
const Conversation = mongoose.model('Conversation',conversationShema);

module.exports = Conversation;