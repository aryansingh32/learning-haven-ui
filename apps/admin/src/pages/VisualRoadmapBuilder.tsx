import { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, GripVertical, Settings, Eye, Loader2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

function SortableItem({ id, title, type, items_count = 0, status }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`bg-card border rounded-lg p-4 flex items-center justify-between shadow-sm transition-shadow ${isDragging ? 'shadow-md border-primary' : 'hover:border-primary/50'}`}>
      <div className="flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary">
          <GripVertical className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            <Badge variant={type === 'path' ? 'default' : 'outline'} className="text-[10px] uppercase tracking-wide">
              {type || 'Course'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{items_count} items inside</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={status === 'published' ? 'secondary' : 'outline'} className={status === 'published' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}>
          {status}
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

export default function VisualRoadmapBuilder() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/courses');
      setItems(res.data || []);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const reorderedItems = items.map((item, index) => ({
        id: item.id,
        order_index: index
      }));
      
      await api.put('/admin/courses/reorder', { courses: reorderedItems });
      toast.success('Roadmap layout saved successfully!');
    } catch (error) {
      toast.error('Failed to save roadmap layout');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Visual Roadmap Builder</h2>
          <p className="text-muted-foreground mt-1">Drag and drop to reorder the main learning paths and courses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info('Preview mode coming soon')}><Eye className="w-4 h-4 mr-2" /> Preview</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Layout
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-md bg-muted/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Main Platform Flow</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-primary">
              <Plus className="w-4 h-4 mr-1" /> Add Node
            </Button>
          </div>
          <CardDescription>This defines the exact sequence of content presented to new users.</CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {items.map((item) => (
                  <SortableItem 
                    key={item.id} 
                    id={item.id}
                    title={item.title}
                    type={item.type}
                    items_count={item.course_items?.length || 0}
                    status={item.is_published ? 'published' : 'draft'}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  );
}
