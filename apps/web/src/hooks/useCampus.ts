import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchCampusMe, fetchMyAssignments, fetchMyCourseAssignments, studentMemberships } from '@/services/campus.service';

/**
 * The learner's college memberships. Fetching it also claims any roster
 * entries their college uploaded for this email, so it runs once per
 * session. A missing or unreachable Campus API just means "no college".
 */
export function useCampusMe() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ['campus-me'],
    queryFn: fetchCampusMe,
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const colleges = studentMemberships(query.data);
  return { ...query, colleges, isStudent: colleges.length > 0 };
}

export function useMyAssignments(enabled = true) {
  return useQuery({
    queryKey: ['campus-my-assignments'],
    queryFn: fetchMyAssignments,
    enabled,
    staleTime: 30 * 1000,
    retry: 1,
    // Keep open/closed states honest while the page is left open.
    refetchInterval: 60 * 1000,
  });
}

/** Courses the college assigned, with the student's own chapter progress. */
export function useMyCourseAssignments(enabled = true) {
  return useQuery({
    queryKey: ['campus-my-course-assignments'],
    queryFn: fetchMyCourseAssignments,
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}
