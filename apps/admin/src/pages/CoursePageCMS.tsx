import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function CoursePageCMS() {
    const queryClient = useQueryClient();
    const [layout, setLayout] = useState<any>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: adminService.getSettings,
    });

    useEffect(() => {
        if (data) {
            const settings = typeof data === 'object' ? (data.settings ?? data) : {};
            if (settings.catalog_layout) {
                // Initialize default text fields if they don't exist
                const l = JSON.parse(JSON.stringify(settings.catalog_layout.value || settings.catalog_layout));
                
                if (!l.sections) l.sections = {};
                if (!l.sections.universities) l.sections.universities = {};
                if (!l.sections.categories) l.sections.categories = {};
                if (!l.sections.careers) l.sections.careers = {};
                if (!l.sections.newAndPopular) l.sections.newAndPopular = {};
                
                if (!l.sections.universities.text) l.sections.universities.text = 'Learn from courses inspired by industry leaders';
                if (!l.sections.universities.partners) {
                    l.sections.universities.partners = (l.sections.universities.logos || []).map((logo: string, i: number) => ({
                        name: `Partner ${i+1}`,
                        logo,
                        courses: 10
                    }));
                }
                setLayout(l);
            }
        }
    }, [data]);

    const saveMut = useMutation({
        mutationFn: async (updatedLayout: any) => {
            return adminService.updateSettings({ catalog_layout: updatedLayout });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast.success('Landing Page configuration saved successfully');
        },
        onError: (e: any) => toast.error(e.response?.data?.error || e.message),
    });

    if (isLoading || !layout) {
        return (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        );
    }

    const updateLayout = (path: string[], value: any) => {
        setLayout((prev: any) => {
            const next = { ...prev };
            let current = next;
            for (let i = 0; i < path.length - 1; i++) {
                current[path[i]] = { ...current[path[i]] };
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return next;
        });
    };

    return (
        <div className="space-y-6 max-w-6xl pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Landing Page CMS</h2>
                    <p className="text-muted-foreground mt-1">Visually edit all elements of the frontend Course Catalog page</p>
                </div>
                <Button onClick={() => saveMut.mutate(layout)} disabled={saveMut.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveMut.isPending ? 'Saving...' : 'Publish Changes'}
                </Button>
            </div>

            <Tabs defaultValue="hero" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="hero">Hero Slides</TabsTrigger>
                    <TabsTrigger value="marquee">Partner Marquee</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="careers">Careers Section</TabsTrigger>
                    <TabsTrigger value="trending">Trending & Popular</TabsTrigger>
                </TabsList>

                {/* Hero Slides */}
                <TabsContent value="hero" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Hero Configuration</CardTitle>
                                    <CardDescription>Configure the main carousel banner</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label>Enable Carousel</Label>
                                    <Switch checked={layout.sliderActive} onCheckedChange={(c) => updateLayout(['sliderActive'], c)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {layout.sliderBanners?.map((slide: any, index: number) => (
                                <Card key={index} className="p-4 border">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-semibold flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground"/> Slide {index + 1}</h4>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                                            const newSlides = [...layout.sliderBanners];
                                            newSlides.splice(index, 1);
                                            updateLayout(['sliderBanners'], newSlides);
                                        }}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Title Text</Label>
                                            <Input value={slide.title} onChange={(e) => {
                                                const newSlides = [...layout.sliderBanners];
                                                newSlides[index].title = e.target.value;
                                                updateLayout(['sliderBanners'], newSlides);
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subtitle Text</Label>
                                            <Input value={slide.subtitle} onChange={(e) => {
                                                const newSlides = [...layout.sliderBanners];
                                                newSlides[index].subtitle = e.target.value;
                                                updateLayout(['sliderBanners'], newSlides);
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Button Label</Label>
                                            <Input value={slide.buttonText} onChange={(e) => {
                                                const newSlides = [...layout.sliderBanners];
                                                newSlides[index].buttonText = e.target.value;
                                                updateLayout(['sliderBanners'], newSlides);
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Image URL (Foreground)</Label>
                                            <Input value={slide.image} onChange={(e) => {
                                                const newSlides = [...layout.sliderBanners];
                                                newSlides[index].image = e.target.value;
                                                updateLayout(['sliderBanners'], newSlides);
                                            }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Background Image URL</Label>
                                            <Input value={slide.backgroundImage || ''} onChange={(e) => {
                                                const newSlides = [...layout.sliderBanners];
                                                newSlides[index].backgroundImage = e.target.value;
                                                updateLayout(['sliderBanners'], newSlides);
                                            }} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            <Button variant="outline" className="w-full" onClick={() => {
                                updateLayout(['sliderBanners'], [...(layout.sliderBanners || []), { id: Date.now().toString(), title: "New Slide", subtitle: "", buttonText: "Click Here", buttonLink: "/courses", image: "", backgroundImage: "" }])
                            }}><Plus className="w-4 h-4 mr-2" /> Add Hero Slide</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Partner Marquee */}
                <TabsContent value="marquee" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Industry Partners Marquee</CardTitle>
                                    <CardDescription>Edit the marquee text and dynamic company cards</CardDescription>
                                </div>
                                <Switch checked={layout.sections.universities.active} onCheckedChange={(c) => updateLayout(['sections', 'universities', 'active'], c)} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Marquee Heading Text</Label>
                                <Input value={layout.sections.universities.text} onChange={(e) => updateLayout(['sections', 'universities', 'text'], e.target.value)} placeholder="Learn from courses inspired by industry leaders" />
                            </div>
                            
                            <div className="space-y-4">
                                <Label>Partner Cards</Label>
                                {layout.sections.universities.partners?.map((partner: any, i: number) => (
                                    <div key={i} className="flex items-end gap-2 p-3 bg-secondary/20 rounded-md border">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Company Name</Label>
                                            <Input value={partner.name} onChange={(e) => {
                                                const newP = [...layout.sections.universities.partners];
                                                newP[i].name = e.target.value;
                                                updateLayout(['sections', 'universities', 'partners'], newP);
                                            }} />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Logo Image URL</Label>
                                            <Input value={partner.logo} onChange={(e) => {
                                                const newP = [...layout.sections.universities.partners];
                                                newP[i].logo = e.target.value;
                                                updateLayout(['sections', 'universities', 'partners'], newP);
                                            }} />
                                        </div>
                                        <div className="w-24 space-y-1">
                                            <Label className="text-xs">Courses #</Label>
                                            <Input type="number" value={partner.courses} onChange={(e) => {
                                                const newP = [...layout.sections.universities.partners];
                                                newP[i].courses = parseInt(e.target.value) || 0;
                                                updateLayout(['sections', 'universities', 'partners'], newP);
                                            }} />
                                        </div>
                                        <Button variant="destructive" size="icon" onClick={() => {
                                            const newP = [...layout.sections.universities.partners];
                                            newP.splice(i, 1);
                                            updateLayout(['sections', 'universities', 'partners'], newP);
                                        }}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="secondary" size="sm" onClick={() => {
                                    updateLayout(['sections', 'universities', 'partners'], [...(layout.sections.universities.partners || []), { name: 'New Partner', logo: '', courses: 1 }])
                                }}><Plus className="w-4 h-4 mr-1"/> Add Partner</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Categories */}
                <TabsContent value="categories" className="space-y-4">
                     <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Explore Categories</CardTitle>
                                    <CardDescription>Manage the pill buttons for filtering</CardDescription>
                                </div>
                                <Switch checked={layout.sections.categories.active} onCheckedChange={(c) => updateLayout(['sections', 'categories', 'active'], c)} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input value={layout.sections.categories.title} onChange={(e) => updateLayout(['sections', 'categories', 'title'], e.target.value)} />
                            </div>
                            <div className="space-y-3">
                                {layout.sections.categories.items?.map((cat: any, i: number) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <Input className="flex-1" placeholder="Category Name" value={cat.name || cat.title} onChange={(e) => {
                                            const c = [...layout.sections.categories.items];
                                            c[i].name = e.target.value;
                                            delete c[i].title; // clean up old title
                                            updateLayout(['sections', 'categories', 'items'], c);
                                        }} />
                                        <Input className="w-40" placeholder="Icon Name (Lucide)" value={cat.icon} onChange={(e) => {
                                            const c = [...layout.sections.categories.items];
                                            c[i].icon = e.target.value;
                                            updateLayout(['sections', 'categories', 'items'], c);
                                        }} />
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                            const c = [...layout.sections.categories.items];
                                            c.splice(i, 1);
                                            updateLayout(['sections', 'categories', 'items'], c);
                                        }}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="secondary" size="sm" onClick={() => {
                                    updateLayout(['sections', 'categories', 'items'], [...(layout.sections.categories.items || []), { name: 'New Category', icon: 'Code' }])
                                }}><Plus className="w-4 h-4 mr-1"/> Add Category</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Careers */}
                <TabsContent value="careers" className="space-y-4">
                     <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Careers Section</CardTitle>
                                    <CardDescription>Manage the career paths displayed on the catalog</CardDescription>
                                </div>
                                <Switch checked={layout.sections.careers.active} onCheckedChange={(c) => updateLayout(['sections', 'careers', 'active'], c)} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {layout.sections.careers.items?.map((career: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-3 p-4 bg-secondary/10 border rounded-md relative">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => {
                                            const c = [...layout.sections.careers.items];
                                            c.splice(i, 1);
                                            updateLayout(['sections', 'careers', 'items'], c);
                                        }}><Trash2 className="w-4 h-4" /></Button>
                                        
                                        <div className="grid grid-cols-2 gap-4 mr-8">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Title</Label>
                                                <Input value={career.title || ''} onChange={(e) => {
                                                    const c = [...layout.sections.careers.items];
                                                    c[i].title = e.target.value;
                                                    updateLayout(['sections', 'careers', 'items'], c);
                                                }} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Salary</Label>
                                                <Input value={career.salary || ''} onChange={(e) => {
                                                    const c = [...layout.sections.careers.items];
                                                    c[i].salary = e.target.value;
                                                    updateLayout(['sections', 'careers', 'items'], c);
                                                }} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Jobs Available</Label>
                                                <Input value={career.jobs || ''} onChange={(e) => {
                                                    const c = [...layout.sections.careers.items];
                                                    c[i].jobs = e.target.value;
                                                    updateLayout(['sections', 'careers', 'items'], c);
                                                }} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Image URL</Label>
                                                <Input value={career.image || ''} onChange={(e) => {
                                                    const c = [...layout.sections.careers.items];
                                                    c[i].image = e.target.value;
                                                    updateLayout(['sections', 'careers', 'items'], c);
                                                }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <Label className="text-xs">Description</Label>
                                            <Textarea rows={2} value={career.description || ''} onChange={(e) => {
                                                const c = [...layout.sections.careers.items];
                                                c[i].description = e.target.value;
                                                updateLayout(['sections', 'careers', 'items'], c);
                                            }} />
                                        </div>
                                    </div>
                                ))}
                                <Button variant="secondary" size="sm" onClick={() => {
                                    updateLayout(['sections', 'careers', 'items'], [...(layout.sections.careers.items || []), { title: 'New Career', salary: '$100k', jobs: '10,000+', image: '', description: '' }])
                                }}><Plus className="w-4 h-4 mr-1"/> Add Career Path</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Trending */}
                <TabsContent value="trending" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Trending Columns</CardTitle>
                                    <CardDescription>Manage the 3-column top charts</CardDescription>
                                </div>
                                <Switch checked={layout.sections.newAndPopular.active} onCheckedChange={(c) => updateLayout(['sections', 'newAndPopular', 'active'], c)} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input value={layout.sections.newAndPopular.title} onChange={(e) => updateLayout(['sections', 'newAndPopular', 'title'], e.target.value)} />
                            </div>
                            <div className="space-y-3">
                                {layout.sections.newAndPopular.columns?.map((col: any, i: number) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <Input className="w-1/3" placeholder="ID (e.g. popular)" value={col.id} onChange={(e) => {
                                            const c = [...layout.sections.newAndPopular.columns];
                                            c[i].id = e.target.value;
                                            updateLayout(['sections', 'newAndPopular', 'columns'], c);
                                        }} />
                                        <Input className="flex-1" placeholder="Display Title (e.g. Most popular)" value={col.title} onChange={(e) => {
                                            const c = [...layout.sections.newAndPopular.columns];
                                            c[i].title = e.target.value;
                                            updateLayout(['sections', 'newAndPopular', 'columns'], c);
                                        }} />
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                            const c = [...layout.sections.newAndPopular.columns];
                                            c.splice(i, 1);
                                            updateLayout(['sections', 'newAndPopular', 'columns'], c);
                                        }}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="secondary" size="sm" onClick={() => {
                                    updateLayout(['sections', 'newAndPopular', 'columns'], [...(layout.sections.newAndPopular.columns || []), { id: 'new_col', title: 'New Column' }])
                                }}><Plus className="w-4 h-4 mr-1"/> Add Column</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
