const { DataTypes } = require('sequelize');
const sequelize = require('../configs/database.js');

const Comment = sequelize.define(
    'Comment',
    {
        comment_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        post_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        parent_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true 
        },
        file_paths: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: []
        },
        is_deleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    },
    {
        timestamps: true,
        underscored: true,
        tableName: 'comments'
    }
);

module.exports = Comment;