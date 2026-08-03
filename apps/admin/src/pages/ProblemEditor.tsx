import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsService } from '../services/problems.service';
import { categoriesService } from '../services/categories.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const ProblemEditor = () => {
    const { id } = useParams();
    const isEditMode = id && id !== 'new';
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        difficulty: 'Easy',
        category_id: '',
        description: '',
        is_premium: false,
        test_cases: '[]',
        code_templates: '[]',
    });

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesService.listCategories,
    });

    const { data: problem, isLoading: isLoadingProblem } = useQuery({
        queryKey: ['problem', id],
        queryFn: () => problemsService.getProblem(id!),
        enabled: !!isEditMode,
    });

    useEffect(() => {
        if (problem) {
            setFormData({
                title: problem.title,
                slug: problem.slug,
                difficulty: problem.difficulty,
                category_id: problem.category_id,
                description: problem.description,
                is_premium: problem.is_premium,
                // These might be objects in API response, need stringify for textarea
                test_cases: JSON.stringify(problem.test_cases || [], null, 2),
                code_templates: JSON.stringify(problem.code_templates || [], null, 2),
            });
        }
    }, [problem]);

    const mutation = useMutation({
        mutationFn: (data: any) => {
            const payload = {
                ...data,
                test_cases: JSON.parse(data.test_cases),
                code_templates: JSON.parse(data.code_templates),
            };
            return isEditMode
                ? problemsService.updateProblem(id!, payload)
                : problemsService.createProblem(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['problems'] });
            toast.success(`Problem ${isEditMode ? 'updated' : 'created'} successfully`);
            navigate('/problems');
        },
        onError: (error: any) => {
            toast.error(`Error: ${error.response?.data?.error || error.message}`);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (isEditMode && isLoadingProblem) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/problems')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight">
                    {isEditMode ? 'Edit Problem' : 'New Problem'}
                </h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Problem Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => handleChange('title', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    value={formData.slug}
                                    onChange={(e) => handleChange('slug', e.target.value)}
                                    placeholder="auto-generated-if-empty"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="difficulty">Difficulty</Label>
                                <Select
                                    value={formData.difficulty}
                                    onValueChange={(val) => handleChange('difficulty', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select difficulty" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Easy">Easy</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="Hard">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    value={formData.category_id}
                                    onValueChange={(val) => handleChange('category_id', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Markdown)</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                className="min-h-[200px] font-mono"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="test_cases">Test Cases (JSON)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        try {
                                            const formatted = JSON.stringify(JSON.parse(formData.test_cases), null, 2);
                                            handleChange('test_cases', formatted);
                                        } catch (e) {
                                            toast.error("Invalid JSON in Test Cases");
                                        }
                                    }}
                                >
                                    Format JSON
                                </Button>
                            </div>
                            <Textarea
                                id="test_cases"
                                value={formData.test_cases}
                                onChange={(e) => handleChange('test_cases', e.target.value)}
                                className={`min-h-[150px] font-mono text-xs ${(() => {
                                    try { JSON.parse(formData.test_cases); return ""; }
                                    catch (e) { return "border-destructive focus-visible:ring-destructive"; }
                                })()}`}
                            />
                            {(() => {
                                try { JSON.parse(formData.test_cases); return null; }
                                catch (e: any) { return <p className="text-[10px] text-destructive">Invalid JSON: {e.message}</p>; }
                            })()}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="code_templates">Code Templates (JSON)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        try {
                                            const formatted = JSON.stringify(JSON.parse(formData.code_templates), null, 2);
                                            handleChange('code_templates', formatted);
                                        } catch (e) {
                                            toast.error("Invalid JSON in Code Templates");
                                        }
                                    }}
                                >
                                    Format JSON
                                </Button>
                            </div>
                            <Textarea
                                id="code_templates"
                                value={formData.code_templates}
                                onChange={(e) => handleChange('code_templates', e.target.value)}
                                className={`min-h-[150px] font-mono text-xs ${(() => {
                                    try { JSON.parse(formData.code_templates); return ""; }
                                    catch (e) { return "border-destructive focus-visible:ring-destructive"; }
                                })()}`}
                            />
                            {(() => {
                                try { JSON.parse(formData.code_templates); return null; }
                                catch (e: any) { return <p className="text-[10px] text-destructive">Invalid JSON: {e.message}</p>; }
                            })()}
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="premium"
                                checked={formData.is_premium}
                                onCheckedChange={(checked) => handleChange('is_premium', checked)}
                            />
                            <Label htmlFor="premium">Premium Problem</Label>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={mutation.isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                {mutation.isPending ? 'Saving...' : 'Save Problem'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProblemEditor;
