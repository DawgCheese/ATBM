const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const publicKeySchema = new Schema({
    userId: {
        type: Types.ObjectId, 
        required: true,
        ref: 'Users', // Liên kết với mô hình User
    },
    publicKey: {
        type: String, // Base64 chuỗi của public key
        required: true,
    },
    createTime: {
        type: Date, // Thời gian tạo khóa
        default: Date.now,
    },
    endTime: {
        type: Date, // Thời gian hết hạn (có thể null nếu không có)
        default: null,
    },
});


const PublicKey = mongoose.model('PublicKey', publicKeySchema);

module.exports = PublicKey;
