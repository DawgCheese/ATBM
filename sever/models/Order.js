const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    items: [
        {
            name: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            size:{type:String,required: true},
        },
    ],
    totalPrice: { type: Number, required: true },
    address: { type: String, required: true },
    customerName: { type: String, required: true }, // Thêm tên khách hàng
    customerPhone: { type: String, required: true }, // Thêm số điện thoại
    status: { type: String,enum: ['Pending', 'Delivery', 'Completed', 'Cancelled'], default: 'Pending' },
    createdAt: { type: Date,  default: Date.now },
    signature: { 
        type: String,
        required: true 
    },
    hash: { 
        type: String, 
        required: true 
    },
});

module.exports = mongoose.model('Order', OrderSchema);