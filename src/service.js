const { Op } = require('sequelize');
const sequelize = require('./configs/database');
const axios = require('axios');
const FormData = require('form-data');

const { Post, UserProfile, Comment } = require('./models'); 
const { 
    connectRabbitMQ, 
    consumeMessage, 
    publishMessage,
    AI_COMMENT_REQUEST_MQ,
    AI_COMMENT_RESPONSE_MQ
} = require('./configs/mq.js');

const FILE_SERVICE_URL = 'http://localhost:3004/files/upload';
const DB_USER_INFOR_SYNC_MQ = "soa_user_infor";

class Service {
    // Connect message to Rabbit MQ
    async connectToMQ() {
        await connectRabbitMQ(DB_USER_INFOR_SYNC_MQ);
    }

    async handleSyncUserDB(eventData) {
        if (eventData.type === 'USER_CREATED') {
            const userData = eventData.payload;

            try {
                await UserProfile.create(userData);

                console.log("ok")
            } catch(err) {
                console.log("Lỗi khi tạo UserProfile của handleSyncUserDB")
            }
        } else if (eventData.type === 'USER_UPDATED') {
            const userData = eventData.payload;

            try {
                const user = await UserProfile.findOne({ where: {user_id: userData.user_id} })

                if (!user) {
                    await UserProfile.create(userData);
                } else {
                    user.update(userData)
                }

                console.log("ok")
            } catch (err) {
                console.log("Lỗi khi sửa UserProfile của handleSyncUserDB")
            }
        }
    }

    async consumeSyncUserDB() {
        await consumeMessage(DB_USER_INFOR_SYNC_MQ, this.handleSyncUserDB);
    }

    // Get a userprofile
    async getUserProfileById(userId) {
        return await UserProfile.findByPk(userId);
    }

    // Upload file to cloudinary
    async uploadFilesToCloudinary(files) {
        if (!files || files.length === 0) return [];

        try {
            const formData = new FormData();

            files.forEach(file => {
                formData.append('files', file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype
                });
            });

            // Call to file upload
            const response = await axios.post(FILE_SERVICE_URL, formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            return response.data.urls || [];
        } catch (error) {
            console.error("Lỗi khi gọi File Service:", error.message);
            throw new Error("FILE_UPLOAD_FAILED");
        }
    }

    // Create post (need fix when have massage broke)
    async createPost(userId, title, content, filesBuffer) {
        const userIdInt = parseInt(userId);

        await UserProfile.findOrCreate({
            where: { user_id: userIdInt },
            defaults: {
                username: `user_${userIdInt}`,
                email: `user${userIdInt}@example.com`,
                role: 'MEMBER'
            }
        });

        let uploadedUrls = [];
        if (filesBuffer && filesBuffer.length > 0) {
            uploadedUrls = await this.uploadFilesToCloudinary(filesBuffer);
        }

        const newPost = await Post.create({
            user_id: userIdInt, 
            title: title,
            content: content,
            file_paths: uploadedUrls 
        });

        // Publish event to AI service for auto-comment
        try {
            await this.publishAICommentRequest('POST_CREATED', {
                post_id: newPost.post_id,
                title: newPost.title,
                content: newPost.content,
                file_paths: newPost.file_paths || []
            });
        } catch (err) {
            console.error("Lỗi khi publish AI comment request:", err);
        }

        return newPost;
    }

    async getPosts({ search, page, filter, sort }) {
        const limit = 10;
        const offset = (page - 1) * limit;

        // Handle search 
        const whereCondition = {};
        if (search) {
            whereCondition.title = { [Op.like]: `%${search}%` };
        }

        // Handle filter (Role)
        const userWhereCondition = {};
        if (filter && filter !== 'ALL') {
            userWhereCondition.role = filter; // 'ADMIN' hoặc 'MEMBER'
        }

        // Handle sort
        let order = [['created_at', 'DESC']]; 
        if (sort === 'trend') {
            order = [[sequelize.literal('view_count + (comment_count * 10)'), 'DESC']];
        }

        // 5. Query Database
        const { rows, count } = await Post.findAndCountAll({
            where: whereCondition,
            limit: limit,
            offset: offset,
            order: order,
            include: [
                {
                    model: UserProfile, 
                    as: 'author',
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role'], 
                    where: userWhereCondition
                }
            ]
        });

        return { posts: rows, total: count, limit: limit };
    }

    // Get a post
    async getPostDetail(postId) {
        
        // Find post by id
        const post = await Post.findByPk(postId, {
            include: [
                {
                    model: UserProfile,
                    as: 'author', 
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                }
            ]
        });

        if (!post) {
            return null;
        }

        await post.increment('view_count'); 
        await post.reload();

        return post;
    }

    // Update a post
    async updatePost(postId, userId, updateData) {
        const { title, content, oldFilePaths, newFilesBuffer } = updateData;

        // Find post
        const post = await Post.findByPk(postId);

        // Check post exis
        if (!post) {
            throw new Error("POST_NOT_FOUND");
        }

        // Check 403 Forbidden
        if (post.user_id !== parseInt(userId)) {
            throw new Error("FORBIDDEN");
        }

        // Handle logic file
        let finalFilePaths = [];

        if (oldFilePaths) {
            if (Array.isArray(oldFilePaths)) {
                finalFilePaths = [...oldFilePaths];
            } else {
                finalFilePaths = [oldFilePaths];
            }
        }

        // Upload new file
        if (newFilesBuffer && newFilesBuffer.length > 0) {
            const newUrls = await this.uploadFilesToCloudinary(newFilesBuffer);
            finalFilePaths = [...finalFilePaths, ...newUrls];
        }

        await post.update({
            title: title,
            content: content,
            file_paths: finalFilePaths
        });

        const updatedPost = await Post.findByPk(postId, {
            include: [
                {
                    model: UserProfile,
                    as: 'author',
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                }
            ]
        });

        return updatedPost;
    }

    // Delete a post
    async deletePost(postId, userId, userRole) {
        
        // Find post
        const post = await Post.findByPk(postId);

        // Check 404
        if (!post) {
            throw new Error("POST_NOT_FOUND");
        }

        // Authorization
        const isOwner = post.user_id === parseInt(userId);
        const isAdmin = userRole === 'ADMIN';

        if (!isOwner && !isAdmin) {
            throw new Error("FORBIDDEN");
        }

        await post.destroy();

        return true;
    }

    // Post a comment
    async createComment(postId, userId, content, parentId, filesBuffer) {

        // Check post exis 
        const post = await Post.findByPk(postId);
        if (!post) {
            throw new Error("POST_NOT_FOUND");
        }

        // Validate parent Id
        const safeParentId = (parentId && parentId !== 'null') ? parseInt(parentId) : null;

        if (safeParentId) {
            const parentComment = await Comment.findByPk(safeParentId);
            if (!parentComment) {
                throw new Error("PARENT_COMMENT_NOT_FOUND");
            }

            // Check parent comment belong to this post
            if (parentComment.post_id !== parseInt(postId)) {
                throw new Error("INVALID_PARENT_COMMENT");
            }
        }

        // Upload file 
        let uploadedUrls = [];
        if (filesBuffer && filesBuffer.length > 0) {
            uploadedUrls = await this.uploadFilesToCloudinary(filesBuffer);
        }

        const userIdInt = parseInt(userId);
        
        const newComment = await Comment.create({
            post_id: parseInt(postId),
            user_id: userIdInt,
            parent_id: safeParentId,
            content: content,
            file_paths: uploadedUrls
        });

        // Increment comment_count
        await post.increment('comment_count');

        const fullComment = await Comment.findByPk(newComment.comment_id, {
            include: [
                {
                    model: UserProfile,
                    as: 'author', 
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                },
                {
                    model: Comment,
                    as: 'parent',
                    include: [
                        {
                            model: UserProfile,
                            as: 'author',
                            attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                        }
                    ]
                }
            ]
        });

        // Check for @uetfa mention and publish to AI service
        if (content && content.toLowerCase().includes('@uetfa')) {
            try {
                await this.publishAICommentRequest('COMMENT_MENTION', {
                    post: {
                        post_id: post.post_id,
                        title: post.title,
                        content: post.content,
                        file_paths: post.file_paths || []
                    },
                    comment: {
                        comment_id: newComment.comment_id,
                        content: newComment.content,
                        file_paths: newComment.file_paths || []
                    }
                });
            } catch (err) {
                console.error("Lỗi khi publish AI comment mention:", err);
            }
        }

        return fullComment;
    }

    // Get comments
    async getComments(postId, page) {
        
        // Check post exis
        const post = await Post.findByPk(postId);
        if (!post) {
            throw new Error("POST_NOT_FOUND");
        }

        const limit = 10;
        const offset = (page - 1) * limit;

        const { count, rows } = await Comment.findAndCountAll({
            where: { 
                post_id: postId,
                is_deleted: false
            },
            limit: limit,
            offset: offset,
            order: [['created_at', 'ASC']], 
            include: [
                {
                    model: UserProfile,
                    as: 'author', 
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                },
                {
                    model: Comment,
                    as: 'parent', 
                    include: [
                        {
                            model: UserProfile,
                            as: 'author',
                            attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                        }
                    ]
                }
            ]
        });

        return {
            comments: rows,
            totalItems: count,
            limit: limit,
            currentPage: page
        };
    }

    // Update a comment
    async updateComment(postId, commentId, userId, updateData) {
        const { content, oldFilePaths, newFilesBuffer } = updateData;

        // Find comment
        const comment = await Comment.findByPk(commentId);

        // Check 404
        if (!comment) {
            throw new Error("COMMENT_NOT_FOUND");
        }

        // Check Consistency
        if (comment.post_id !== parseInt(postId)) {
            throw new Error("COMMENT_NOT_BELONG_TO_POST");
        }

        // Check Deleted
        if (comment.is_deleted) {
            throw new Error("CANNOT_UPDATE_DELETED_COMMENT");
        }

        // Authorization
        if (comment.user_id !== parseInt(userId)) {
            throw new Error("FORBIDDEN");
        }

        // Handle logic file
        let finalFilePaths = [];

        if (oldFilePaths) {
            if (Array.isArray(oldFilePaths)) {
                finalFilePaths = [...oldFilePaths];
            } else {
                finalFilePaths = [oldFilePaths];
            }
        }

        if (newFilesBuffer && newFilesBuffer.length > 0) {
            const newUrls = await this.uploadFilesToCloudinary(newFilesBuffer);
            finalFilePaths = [...finalFilePaths, ...newUrls];
        }

        await comment.update({
            content: content,
            file_paths: finalFilePaths
        });

        // Return updated data
        const updatedComment = await Comment.findByPk(commentId, {
            include: [
                {
                    model: UserProfile,
                    as: 'author',
                    attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                },
                {
                    model: Comment,
                    as: 'parent',
                    include: [
                        {
                            model: UserProfile,
                            as: 'author',
                            attributes: ['username', 'fullname', 'avatar_image_link', 'role']
                        }
                    ]
                }
            ]
        });

        return updatedComment;
    }

    // Delete a comment
    async deleteComment(postId, commentId, userId) {
        
        // Find comment
        const comment = await Comment.findByPk(commentId);
        if (!comment) {
            throw new Error("COMMENT_NOT_FOUND");
        }

        // Check comment belong to this post
        if (comment.post_id !== parseInt(postId)) {
            throw new Error("COMMENT_NOT_BELONG_TO_POST");
        }

        // Check is_deleted
        if (comment.is_deleted) {
            throw new Error("COMMENT_ALREADY_DELETED");
        }

        const requestUser = await UserProfile.findByPk(userId);
        if (!requestUser) {
            throw new Error("USER_NOT_FOUND");
        }

        // Check role
        const isOwner = comment.user_id === parseInt(userId);
        const isAdmin = requestUser.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            throw new Error("FORBIDDEN");
        }

        await comment.update({
            is_deleted: true,
            content: null,      
            file_paths: null
        });

        // Decre comment count
        const post = await Post.findByPk(postId);
        if (post) {
            await post.decrement('comment_count');
        }

        return true;
    }

    // ===== AI COMMENT MQ METHODS =====
    
    /**
     * Publish AI comment request to message queue
     */
    async publishAICommentRequest(eventType, data) {
        try {
            const message = {
                type: eventType,
                payload: data
            };
            
            await publishMessage(AI_COMMENT_REQUEST_MQ, message);
            console.log(`✅ Published ${eventType} to AI service`);
        } catch (error) {
            console.error("Error publishing AI comment request:", error);
            throw error;
        }
    }

    /**
     * Consume AI comment response from message queue
     */
    async consumeAICommentResponse() {
        await consumeMessage(AI_COMMENT_RESPONSE_MQ, this.handleAICommentResponse.bind(this));
    }

    /**
     * Handle AI comment response - Create comment from AI
     */
    async handleAICommentResponse(eventData) {
        try {
            if (eventData.type === 'AI_COMMENT_CREATED') {
                const { post_id, user_id, content, parent_id } = eventData.payload;
                
                console.log(`🤖 Creating AI comment for post ${post_id}`);
                
                // Check if post exists
                const post = await Post.findByPk(post_id);
                if (!post) {
                    console.error(`Post ${post_id} not found`);
                    return;
                }
                
                // Create comment from AI (no files)
                const aiComment = await Comment.create({
                    post_id: parseInt(post_id),
                    user_id: parseInt(user_id),
                    parent_id: parent_id ? parseInt(parent_id) : null,
                    content: content,
                    file_paths: [] // AI doesn't upload files
                });
                
                // Increment comment count
                await post.increment('comment_count');
                
                console.log(`✅ AI comment created: ${aiComment.comment_id}`);
            }
        } catch (error) {
            console.error("Error handling AI comment response:", error);
        }
    }
}

module.exports = new Service();