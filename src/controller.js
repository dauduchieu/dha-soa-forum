const service = require('./service.js');

class Controller {
    
    // Connect MQ
    async connectMQ() {
        await service.connectToMQ();
    }

    // Consume MQ
    async consumeSyncUserDB() {
        await service.consumeSyncUserDB()
    }

    // Consume AI Comment Response MQ
    async consumeAICommentResponse() {
        await service.consumeAICommentResponse();
    }

    async newPost(req, res) {
        try {
            const user_id = req.header("x-user-id");
            if (!user_id) {
                return res.status(401).json({ message: "Unauthorized: Missing User ID" });
            }

            // Take text data
            const { title, content } = req.body;
            if (!title || !content) {
                return res.status(400).json({ message: "Missing title or content" });
            }

            // Take file data
            const files = req.files; 

            // Call service
            const post = await service.createPost(user_id, title, content, files);

            return res.status(201).json({post_id: post.post_id});

        } catch (error) {
            console.error("Create Post:", error);

            if (error.message === "FILE_UPLOAD_FAILED") {
                return res.status(502).json({ message: "Error uploading files to storage" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Get post
    async getPosts(req, res) {
        try {
            const { search, page, filter, sort } = req.query;

            // Validate 
            const pageInt = parseInt(page) || 1;
            const filterStr = filter || 'ALL';
            const sortStr = sort || 'time';

            // Call service
            const data = await service.getPosts({
                search: search,
                page: pageInt,
                filter: filterStr,
                sort: sortStr
            });

            const responsePosts = data.posts.map(post => {
                const author = post.author || {}; 
                
                return {
                    post_id: post.post_id,
                    title: post.title,
                    create_at: post.createdAt,
                    view_count: post.view_count,
                    comment_count: post.comment_count,
                    user: {
                        username: author.username,
                        fullname: author.fullname,
                        avatar_image_link: author.avatar_image_link,
                        role: author.role
                    }
                };
            });

            return res.status(200).json({
                posts: responsePosts,
                meta: {
                    total_items: data.total,
                    page_size: data.limit,
                    current_page: pageInt,
                    total_pages: Math.ceil(data.total / data.limit)
                }
            });

        } catch (error) {
            console.error("Get Posts Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Get a post
    async getPostDetail(req, res) {
        try {
            const { post_id } = req.params;

            // Call service 
            const post = await service.getPostDetail(post_id);

            // Not Found
            if (!post) {
                return res.status(404).json({ message: "Post not found" });
            }

            // Prepare author data
            const author = post.author || {};

            const response = {
                post_id: post.post_id,
                title: post.title,
                content: post.content,
                file_paths: post.file_paths, 
                create_at: post.createdAt, 
                view_count: post.view_count,
                comment_count: post.comment_count,
                user: {
                    username: author.username,
                    fullname: author.fullname,
                    avatar_image_link: author.avatar_image_link,
                    role: author.role
                }
            };

            return res.status(200).json(response);

        } catch (error) {
            console.error("Get Post Detail Error:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Update post
    async updatePost(req, res) {
        try {
            const { post_id } = req.params;
            const user_id = req.header("x-user-id");

            const { title, content, old_file_paths } = req.body;
            const new_files = req.files;

            // Validate 
            if (!title || !content) {
                return res.status(400).json({ message: "Missing title or content" });
            }

            // Call Service
            const updatedPost = await service.updatePost(post_id, user_id, {
                title,
                content,
                oldFilePaths: old_file_paths,
                newFilesBuffer: new_files
            });

            const author = updatedPost.author || {};

            const response = {
                post_id: updatedPost.post_id,
                title: updatedPost.title,
                content: updatedPost.content,
                file_paths: updatedPost.file_paths,
                create_at: updatedPost.createdAt,
                view_count: updatedPost.view_count,
                comment_count: updatedPost.comment_count,
                user: {
                    username: author.username,
                    fullname: author.fullname,
                    avatar_image_link: author.avatar_image_link,
                    role: author.role
                }
            };

            return res.status(200).json(response);

        } catch (error) {
            console.error("Update Post Error:", error.message);

            if (error.message === "POST_NOT_FOUND") {
                return res.status(404).json({ message: "Post not found" });
            }
            if (error.message === "FORBIDDEN") {
                return res.status(403).json({ message: "Forbidden: You are not the owner of this post" });
            }
            if (error.message === "FILE_UPLOAD_FAILED") {
                return res.status(502).json({ message: "Error uploading new files" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Delete post
    async deletePost(req, res) {
        try {
            const { post_id } = req.params;
            const user_id = req.header("x-user-id");

            const user_profile = await service.getUserProfileById(user_id);
            const role = user_profile.role;

            await service.deletePost(post_id, user_id, role);

            return res.status(200).json({ message: "Delete successfully" });
        } catch (error) {
            console.error("Delete Post Error:", error.message);

            if (error.message === "POST_NOT_FOUND") {
                return res.status(404).json({ message: "Post not found" });
            }
            if (error.message === "FORBIDDEN") {
                return res.status(403).json({ message: "Forbidden: You are not allowed to delete this post" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Create a comment
    async createComment(req, res) {
        try {
            const { post_id } = req.params;
            const user_id = req.header("x-user-id");
            
            const { content, parent_id } = req.body;
            const files = req.files;

            // Validate
            if (!content) {
                return res.status(400).json({ message: "Content is required" });
            }

            // Call service
            const comment = await service.createComment(post_id, user_id, content, parent_id, files);

            const author = comment.author || {};
            const parent = comment.parent;
            
            const response = {
                comment_id: comment.comment_id,
                content: comment.content,
                file_paths: comment.file_paths,
                is_deleted: comment.is_deleted,
                create_at: comment.createdAt,
                user: {
                    username: author.username,
                    fullname: author.fullname,
                    avatar_image_link: author.avatar_image_link,
                    role: author.role
                },
                parent: parent ? {
                    comment_id: parent.comment_id,
                    content: parent.content,
                    file_paths: parent.file_paths,
                    is_deleted: comment.is_deleted,
                    create_at: parent.createdAt,
                    user: {
                        username: parent.author?.username,
                        fullname: parent.author?.fullname,
                        avatar_image_link: parent.author?.avatar_image_link,
                        role: parent.author?.role
                    }
                } : null
            };

            return res.status(201).json(response);

        } catch (error) {
            console.error("Create Comment Error:", error.message);

            if (error.message === "POST_NOT_FOUND") {
                return res.status(404).json({ message: "Post not found" });
            }
            if (error.message === "PARENT_COMMENT_NOT_FOUND") {
                return res.status(400).json({ message: "Parent comment not found" });
            }
            if (error.message === "INVALID_PARENT_COMMENT") {
                return res.status(400).json({ message: "Parent comment does not belong to this post" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Get comments
    async getComments(req, res) {
        try {
            const { post_id } = req.params;

            const page = parseInt(req.query.page) || 1;

            // Call service
            const data = await service.getComments(post_id, page);

            const responseComments = data.comments.map(comment => {
                const author = comment.author || {};
                const parent = comment.parent;

                return {
                    comment_id: comment.comment_id,
                    content: comment.content,
                    file_paths: comment.file_paths,
                    is_deleted: comment.is_deleted,
                    create_at: comment.createdAt,
                    user: {
                        username: author.username,
                        fullname: author.fullname,
                        avatar_image_link: author.avatar_image_link,
                        role:  author.role
                    },

                    parent: parent ? {
                        comment_id: parent.comment_id,
                        content: parent.content,
                        file_paths: parent.file_paths,
                        is_deleted: parent.is_deleted,
                        create_at: parent.createdAt,
                        user: {
                            username: parent.author?.username,
                            fullname: parent.author?.fullname,
                            avatar_image_link: parent.author?.avatar_image_link,
                            role: parent.author?.role
                        }
                    } : null
                };
            });

            const totalPages = Math.ceil(data.totalItems / data.limit);

            return res.status(200).json({
                comments: responseComments,
                meta: {
                    total_items: data.totalItems,
                    page_size: data.limit,
                    current_page: data.currentPage,
                    total_pages: totalPages
                }
            });

        } catch (error) {
            console.error("Get Comments Error:", error.message);

            if (error.message === "POST_NOT_FOUND") {
                return res.status(404).json({ message: "Post not found" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Update a comment
    async updateComment(req, res) {
        try {
            const { post_id, comment_id } = req.params;
            const user_id = req.header("x-user-id");

            const { content, old_file_paths } = req.body;
            const new_files = req.files;

            // Validate
            if (!content) {
                return res.status(400).json({ message: "Content is required" });
            }
            if (old_file_paths === null) {
                return res.status(400).json({ message: "Old_file_paths is required" });
            }

            // Call service
            const comment = await service.updateComment(post_id, comment_id, user_id, {
                content,
                oldFilePaths: old_file_paths,
                newFilesBuffer: new_files
            });

            const author = comment.author || {};
            const parent = comment.parent;

            const response = {
                comment_id: comment.comment_id,
                content: comment.content,
                file_paths: comment.file_paths,
                is_deleted: comment.is_deleted,
                create_at: comment.createdAt,
                user: {
                    username: author.username,
                    fullname: author.fullname,
                    avatar_image_link: author.avatar_image_link,
                    role: author.role
                },
                parent: parent ? {
                    comment_id: parent.comment_id,
                    content: parent.content,
                    file_paths: parent.file_paths,
                    is_deleted: parent.is_deleted,
                    create_at: parent.createdAt,
                    user: {
                        username: parent.author?.username,
                        fullname: parent.author?.fullname,
                        avatar_image_link: parent.author?.avatar_image_link,
                        role: parent.author?.role
                    }
                } : null
            };

            return res.status(200).json(response);

        } catch (error) {
            console.error("Update Comment Error:", error.message);

            if (error.message === "COMMENT_NOT_FOUND") {
                return res.status(404).json({ message: "Comment not found" });
            }
            if (error.message === "CANNOT_UPDATE_DELETED_COMMENT") {
                return res.status(404).json({ message: "Cannot update deleted comment" });
            }
            if (error.message === "COMMENT_NOT_BELONG_TO_POST") {
                return res.status(400).json({ message: "Comment does not belong to this post" });
            }
            if (error.message === "FORBIDDEN") {
                return res.status(403).json({ message: "Forbidden: You are not the owner of this comment" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }

    // Delete a comment
    async deleteComment(req, res) {
        try {
            const { post_id, comment_id } = req.params;
            const user_id = req.header("x-user-id");

            await service.deleteComment(post_id, comment_id, user_id);

            return res.status(200).json({ message: "ok" });

        } catch (error) {
            console.error("Delete Comment Error:", error.message);

            if (error.message === "COMMENT_NOT_FOUND") {
                return res.status(404).json({ message: "Comment not found" });
            }
            if (error.message === "COMMENT_NOT_BELONG_TO_POST") {
                return res.status(400).json({ message: "Comment does not belong to this post" });
            }
            if (error.message === "USER_NOT_FOUND") {
                return res.status(400).json({ message: "User not found" });
            }
            if (error.message === "COMMENT_ALREADY_DELETED") {
                return res.status(400).json({ message: "Comment has already been deleted" });
            }
            if (error.message === "FORBIDDEN") {
                return res.status(403).json({ message: "Forbidden: You are not allowed to delete this comment" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    }
}

module.exports = new Controller();