const { Email } = require('@mui/icons-material');
const mongoose = require('mongoose')

const userShema = mongoose.Schema({
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
    verificationCode: { // Add verification code for email verification
        type: String,
    },
    isVerified: { // Add verification status
        type: Boolean,
        default: false,
    }
});
 
const Users = mongoose.model('User',userShema);

module.exports = Users;