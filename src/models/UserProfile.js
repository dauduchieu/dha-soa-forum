const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database');

const UserProfile = sequelize.define('UserProfile', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false
    },
    username: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    fullname: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    avatar_image_link: {
        type: DataTypes.STRING,
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM('MEMBER', 'ADMIN'),
        defaultValue: 'MEMBER'
    },
    is_banned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'user_profiles',
    timestamps: true,
    underscored: true
});

module.exports = UserProfile;