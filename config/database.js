// DB config placeholder
// module.exports = { url: 'mongodb://localhost:27017/toletech' };
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/toletech';
const MONGO_URI_OL="mongodb+srv://toletech_user_db:passer123@cluster0.kxacmv7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const connectDatabase= async() => {
    try {
        await mongoose.connect(MONGO_URI_OL, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true
        })
        console.log('MongoDB connected')
    } catch (error) {
        console.log(error)
        process.exit(1)
    }
    
}


module.exports = connectDatabase;