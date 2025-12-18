const { DataTypes } = require('sequelize')
const sequelize = require('../configs/database.js')

const Post = sequelize.define(
    'Post',
    {
        post_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        title: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        file_paths: {
            type: DataTypes.JSON, 
            allowNull: true,
            defaultValue: [] 
        },
        view_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        comment_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    {
        timestamps: true,
        underscored: true, // created_at and updated_at
        tableName: 'posts'
    }
)

module.exports = Post
