const UserProfile = require('./UserProfile')
const Post = require('./Post')
const Comment = require('./Comment')

// User - Post
UserProfile.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });
Post.belongsTo(UserProfile, { foreignKey: 'user_id', as: 'author' });

// User - Comment
UserProfile.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' })
Comment.belongsTo(UserProfile, { foreignKey: 'user_id', as: 'author' })

// Post - Comment
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments', onDelete: 'CASCADE' })
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' })

// Comment - Comment (Reply)
Comment.hasMany(Comment, { foreignKey: 'parent_id', as: 'replies' })
Comment.belongsTo(Comment, { foreignKey: 'parent_id', as: 'parent' })

module.exports = {
    UserProfile,
    Post,
    Comment
}
