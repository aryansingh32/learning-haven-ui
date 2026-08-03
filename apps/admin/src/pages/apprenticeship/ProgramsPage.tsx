import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Loader2, GraduationCap, Archive, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Program {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration_days: number;
  price_inr: number;
  original_price_inr: number | null;
  tech_stack: string[];
  difficulty_level: string;
  total_projects: number;
  enrolled_count: number;
  status: 'draft' | 'active' | 'archived';
  max_enrollments: number | null;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
    case 'draft': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    case 'archived': return 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100';
    default: return '';
  }
};

const getDifficultyColor = (level: string) => {
  switch (level) {
    case 'beginner': return 'bg-sky-100 text-sky-800 hover:bg-sky-100';
    case 'intermediate': return 'bg-violet-100 text-violet-800 hover:bg-violet-100';
    case 'advanced': return 'bg-rose-100 text-rose-800 hover:bg-rose-100';
    default: return '';
  }
};

const formatPrice = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
};

const ProgramsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['apprenticeship-programs'],
    queryFn: () => apprenticeshipApi.listPrograms(),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apprenticeshipApi.archiveProgram(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apprenticeship-programs'] });
      toast.success('Program archived');
    },
    onError: () => toast.error('Failed to archive program'),
  });

  const programs: Program[] = data?.programs || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            Apprenticeship Programs
          </h2>
          <p className="text-muted-foreground">
            Create and manage apprenticeship programs, projects, and test suites.
          </p>
        </div>
        <Button onClick={() => navigate('/apprenticeship/programs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Program
        </Button>
      </div>

      {/* Programs Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </TableCell>
              </TableRow>
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <GraduationCap className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No programs yet. Create your first apprenticeship program.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <div className="font-medium">{program.title}</div>
                    <div className="text-xs text-muted-foreground">/{program.slug}</div>
                    {program.tech_stack?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {program.tech_stack.slice(0, 3).map((tech) => (
                          <Badge key={tech} variant="outline" className="text-[10px] px-1 py-0">
                            {tech}
                          </Badge>
                        ))}
                        {program.tech_stack.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{program.tech_stack.length - 3}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getDifficultyColor(program.difficulty_level)} variant="outline">
                      {program.difficulty_level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{program.total_projects}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatPrice(program.price_inr)}</div>
                    {program.original_price_inr && (
                      <div className="text-xs text-muted-foreground line-through">
                        {formatPrice(program.original_price_inr)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{program.enrolled_count}</span>
                    {program.max_enrollments && (
                      <span className="text-xs text-muted-foreground"> / {program.max_enrollments}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(program.status)} variant="outline">
                      {program.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{program.duration_days} days</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigate(`/apprenticeship/programs/${program.id}/edit`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Edit Program
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {program.status !== 'archived' && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm('Archive this program? Students can still complete but no new enrollments.')) {
                                archiveMutation.mutate(program.id);
                              }
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProgramsPage;
