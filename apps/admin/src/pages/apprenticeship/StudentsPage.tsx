import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const StudentsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['apprenticeship-admin-students'],
    queryFn: () => apprenticeshipApi.getStudents(),
    refetchInterval: 15000,
  });

  const students = useMemo(() => {
    const items = data?.students || [];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter((row: any) => {
      const haystack = `${row.users?.full_name || ''} ${row.users?.email || ''} ${row.apprenticeship_programs?.title || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [data?.students, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Students</h2>
        <p className="text-muted-foreground">Enrollment health, GitHub status, and progress across apprenticeship programs.</p>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by student, email, or program"
        className="max-w-sm"
      />

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Total XP</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No students found.</TableCell>
                </TableRow>
              ) : students.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.users?.full_name || 'Unknown user'}</div>
                    <div className="text-xs text-muted-foreground">{row.users?.email}</div>
                  </TableCell>
                  <TableCell>{row.apprenticeship_programs?.title || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.completed_projects}/{row.total_projects}</TableCell>
                  <TableCell>{row.users?.xp || 0}</TableCell>
                  <TableCell>{row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/apprenticeship/students/${row.user_id}`)}>
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentsPage;
