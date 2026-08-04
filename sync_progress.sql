UPDATE course_enrollments ce
SET progress_percentage = sub.progress
FROM (
    SELECT 
        ucp.user_id,
        c.course_id,
        ROUND(
            COUNT(CASE WHEN ucp.status = 'COMPLETED' THEN 1 END) * 100.0 / 
            NULLIF((SELECT COUNT(*) FROM chapters WHERE course_id = c.course_id), 0)
        ) as progress
    FROM user_chapter_progress ucp
    JOIN chapters c ON c.id = ucp.chapter_id
    GROUP BY ucp.user_id, c.course_id
) sub
WHERE ce.user_id = sub.user_id AND ce.course_id = sub.course_id;
