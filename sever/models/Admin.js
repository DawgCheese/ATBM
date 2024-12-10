const mongoose = require('mongoose')

const adminShema = mongoose.Schema({
    fullName:{
        type:String,
        require:true,
    },
    email:{
        type:String,
        require:true,
        unique: true
    },
    password:{
        type:String,
        require:true,
    },
    phone:{
        type:String,
        require:true,
    },
    address:{
        type:String,
        require:true,
    },
    token:{
        type:String
    },
   
});
 
const Admin = mongoose.model('Admin',adminShema);

module.exports = Admin;