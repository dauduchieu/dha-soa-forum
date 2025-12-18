// services/forum-service/seed_forum.js
const sequelize = require('./configs/database');
const UserProfile = require('./models/UserProfile');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

const seedForum = async () => {
    try {
        await sequelize.authenticate();
        console.log('🔌 Forum DB Connected.');

        // Xóa sạch dữ liệu cũ để tránh trùng lặp
        await Comment.sync({ force: true });
        await Post.sync({ force: true });
        await UserProfile.sync({ force: true });
        console.log('⚠️ Forum tables reset.');

        // 1. TẠO USER PROFILE (Sync từ Auth)
        const userProfiles = [
            { user_id: 1, username: 'admin_user', email: 'admin@uet.vnu.edu.vn', fullname: 'Admin Quản Trị', role: 'ADMIN', is_banned: false, avatar_image_link: 'https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff' },
            { user_id: 2, username: 'nguyenvana', email: 'nguyenvana@gmail.com', fullname: 'Nguyễn Văn A', role: 'MEMBER', is_banned: false, avatar_image_link: 'https://ui-avatars.com/api/?name=Nguyen+A&background=0D8ABC&color=fff' },
            { user_id: 3, username: 'lethib', email: 'lethib@gmail.com', fullname: 'Lê Thị B', role: 'MEMBER', is_banned: false, avatar_image_link: 'https://ui-avatars.com/api/?name=Le+B&background=random' },
            { user_id: 4, username: 'banned_guy', email: 'banned@gmail.com', fullname: 'Thanh Niên Bị Ban', role: 'MEMBER', is_banned: true, avatar_image_link: 'https://ui-avatars.com/api/?name=Ban&background=000&color=fff' },
            { user_id: 5, username: 'uetfa_ai', email: 'ai@uetfa.edu.vn', fullname: 'UETFA AI Assistant', role: 'ADMIN', is_banned: false, avatar_image_link: 'https://ui-avatars.com/api/?name=AI&background=4f46e5&color=fff' }
        ];
        await UserProfile.bulkCreate(userProfiles);
        console.log('✅ UserProfiles Created.');

        // 2. TẠO 15 BÀI VIẾT (POSTS)
        // Tạo thời gian lệch nhau một chút để test sắp xếp (mặc dù ID tự tăng cũng dùng để sort được)
        const postsData = [
            { user_id: 1, title: '[QUAN TRỌNG] Quy định chung của diễn đàn UET FA', content: '<p>Yêu cầu các thành viên tuân thủ quy định: Không spam, không văng tục...</p>', view_count: 9999, comment_count: 5 },
            { user_id: 2, title: 'Cứu em môn Giải tích 1 với ạ!', content: '<p>Mọi người ơi cho em xin tài liệu ôn thi cuối kỳ với, em mất gốc rồi :(</p>', view_count: 120, comment_count: 3 },
            { user_id: 3, title: 'Review quán bún chả cổng sau', content: '<p>Sáng nay mới ăn thử, thịt nướng hơi cháy nhưng nước chấm ngon. 7/10 nhé.</p>', view_count: 450, comment_count: 2 },
            { user_id: 2, title: 'Tìm đồng đội đá bóng sân nhân tạo tối thứ 5', content: '<p>Team em thiếu 2 slot thủ môn, ai rảnh inbox nhé.</p>', view_count: 80, comment_count: 1 },
            { user_id: 3, title: 'Góc tìm đồ: Rơi thẻ sinh viên', content: '<p>Em có đánh rơi thẻ SV tên Lê Thị B ở nhà xe G2, ai thấy cho em xin lại ạ.</p>', view_count: 200, comment_count: 4 },
            { user_id: 1, title: 'Thông báo lịch nghỉ tết Nguyên Đán 2026', content: '<p>Nhà trường thông báo lịch nghỉ tết chính thức...</p>', view_count: 5000, comment_count: 0 },
            { user_id: 2, title: 'Nên học React hay VueJS năm 2026?', content: '<p>Em thấy Vue dễ học hơn nhưng React tuyển dụng nhiều quá, mn tư vấn giúp em.</p>', view_count: 890, comment_count: 6 },
            { user_id: 3, title: 'Pass lại giáo trình Triết học Mác - Lênin', content: '<p>Sách còn mới 99%, giá hạt dẻ cho các em khóa sau.</p>', view_count: 50, comment_count: 1 },
            { user_id: 2, title: 'Laptop bị màn hình xanh liên tục', content: '<p>Máy em đang code thì bị dump xanh, lỗi code 0x000000, ai biết sửa không ạ?</p>', view_count: 150, comment_count: 2 },
            { user_id: 3, title: 'Confession #1024: Crush bạn nữ mặc áo trắng', content: '<p>Sáng nay gặp bạn ở thang máy nhà G2, bạn cười xinh quá làm mình quên bấm tầng...</p>', view_count: 3000, comment_count: 10 },
            { user_id: 1, title: 'Cảnh báo lừa đảo vay tiền qua app', content: '<p>Hiện nay có nhiều hình thức lừa đảo mới nhắm vào sinh viên...</p>', view_count: 2200, comment_count: 0 },
            { user_id: 2, title: 'Hỏi về học bổng khuyến khích học tập', content: '<p>Kỳ này GPA 3.2 có được học bổng loại C không mọi người?</p>', view_count: 600, comment_count: 3 },
            { user_id: 3, title: 'Tìm trọ khu vực Dịch Vọng Hậu', content: '<p>Tài chính 3tr quay đầu, cần tìm phòng khép kín, có điều hòa.</p>', view_count: 400, comment_count: 2 },
            { user_id: 2, title: 'Lỗi khi cài Docker trên Windows Home', content: '<p>Em cài WSL2 rồi mà Docker Desktop vẫn báo lỗi, help me!</p>', view_count: 110, comment_count: 1 },
            { user_id: 3, title: 'Góc thanh lý: Bàn phím cơ Keychron K2', content: '<p>Lên đời nên pass lại em phím cơ blue switch, ồn ào vui tai.</p>', view_count: 350, comment_count: 2 }
        ];

        // Bulk create Posts
        await Post.bulkCreate(postsData);
        console.log(`✅ Created ${postsData.length} Posts.`);

        // 3. TẠO 20+ COMMENTS (Bao gồm cả Reply/Nested Comment)
        // Lưu ý: post_id và parent_id dựa trên giả định ID bài viết chạy từ 1->15
        const commentsData = [
            // Post 1: Quy định (5 comments)
            { post_id: 1, user_id: 2, parent_id: null, content: 'Đã rõ ạ.' },
            { post_id: 1, user_id: 3, parent_id: null, content: 'Admin cho em hỏi về quy định avatar với.' },
            { post_id: 1, user_id: 1, parent_id: 2, content: 'Avatar không được chứa nội dung đồi trụy nhé bạn.' }, // Reply cmt 2
            { post_id: 1, user_id: 3, parent_id: 3, content: 'Dạ vâng em cảm ơn.' }, // Reply cmt 3 (Nested cấp 2)
            { post_id: 1, user_id: 2, parent_id: null, content: 'Up cho mọi người cùng đọc.' },

            // Post 2: Cứu môn Giải tích (3 comments)
            { post_id: 2, user_id: 3, parent_id: null, content: 'Inbox mình gửi file đề cũ cho.' },
            { post_id: 2, user_id: 2, parent_id: 6, content: 'Tuyệt vời, check inbox nhé bạn ơi.' }, // Reply cmt 6
            { post_id: 2, user_id: 1, parent_id: null, content: 'Lên thư viện mượn sách bài tập về cày là qua.' },

            // Post 3: Bún chả (2 comments)
            { post_id: 3, user_id: 2, parent_id: null, content: 'Quán này mình ăn rồi, hơi đắt.' },
            { post_id: 3, user_id: 3, parent_id: 9, content: '40k một suất là chuẩn giá khu này rồi ông.' },

            // Post 5: Tìm thẻ SV (4 comments)
            { post_id: 5, user_id: 2, parent_id: null, content: 'Thử lên phòng công tác sinh viên hỏi xem.' },
            { post_id: 5, user_id: 1, parent_id: null, content: 'Mình thấy bảo vệ G2 có giữ một cái thẻ đấy.' },
            { post_id: 5, user_id: 3, parent_id: 12, content: 'Ôi thật ạ? Để em xuống hỏi luôn.' },
            { post_id: 5, user_id: 3, parent_id: 13, content: 'Em lấy được rồi ạ, cảm ơn admin nhiều!' },

            // Post 7: React vs Vue (6 comments - Tranh luận xôm)
            { post_id: 7, user_id: 3, parent_id: null, content: 'Vote React nhé, cộng đồng đông.' },
            { post_id: 7, user_id: 2, parent_id: 15, content: 'Nhưng Vue code ngắn gọn hơn nhiều.' },
            { post_id: 7, user_id: 1, parent_id: null, content: 'Học cái nào cũng được, quan trọng là tư duy.' },
            { post_id: 7, user_id: 3, parent_id: 17, content: 'Chuẩn luôn admin.' },
            { post_id: 7, user_id: 2, parent_id: null, content: 'Thôi học Angular cho khác biệt =))' },
            { post_id: 7, user_id: 3, parent_id: 19, content: 'Angular khó lắm ông ơi.' },

            // Post 10: Confession (Nhiều comment ảo)
            { post_id: 10, user_id: 2, parent_id: null, content: 'Lại văn vở rồi.' },
            { post_id: 10, user_id: 3, parent_id: null, content: 'Hóng info bạn nữ.' }
        ];

        await Comment.bulkCreate(commentsData);
        console.log(`✅ Created ${commentsData.length} Comments.`);

        // 4. CẬP NHẬT VIEW & COMMENT COUNT (Optional: Để dữ liệu thống nhất)
        // Logic thực tế thì khi tạo comment sẽ tăng count, nhưng ở đây ta seed nên ta đã hardcode số lượng ở bước 2 rồi.
        // Bước này chỉ mang tính minh họa nếu bạn muốn tính toán lại cho chuẩn xác 100%.

        console.log('✅ Forum Service Seeded Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seed Forum Failed:', error);
        process.exit(1);
    }
};

seedForum();