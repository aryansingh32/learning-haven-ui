import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const emptyForm = {
  code: '',
  discount_type: 'percentage',
  discount_value: 10,
  max_uses: 100,
  per_user_limit: 1,
};

const CouponsPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data } = useQuery({
    queryKey: ['apprenticeship-admin-coupons'],
    queryFn: () => apprenticeshipApi.listCoupons(),
  });

  const createMutation = useMutation({
    mutationFn: () => apprenticeshipApi.createCoupon(form),
    onSuccess: () => {
      toast.success('Coupon created');
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['apprenticeship-admin-coupons'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create coupon'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apprenticeshipApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated');
      void queryClient.invalidateQueries({ queryKey: ['apprenticeship-admin-coupons'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Coupons</h2>
        <p className="text-muted-foreground">Create and deactivate apprenticeship discount codes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Create Coupon</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} placeholder="LHAPR2026" />
            <Select value={form.discount_type} onValueChange={(value) => setForm((prev) => ({ ...prev, discount_type: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" value={form.discount_value} onChange={(event) => setForm((prev) => ({ ...prev, discount_value: Number(event.target.value) }))} placeholder="Discount value" />
            <Input type="number" value={form.max_uses} onChange={(event) => setForm((prev) => ({ ...prev, max_uses: Number(event.target.value) }))} placeholder="Max uses" />
            <Input type="number" value={form.per_user_limit} onChange={(event) => setForm((prev) => ({ ...prev, per_user_limit: Number(event.target.value) }))} placeholder="Per user limit" />
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Create Coupon
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.coupons || []).map((coupon: any) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-medium">{coupon.code}</TableCell>
                    <TableCell>{coupon.discount_type}</TableCell>
                    <TableCell>{coupon.discount_value}</TableCell>
                    <TableCell>{coupon.uses_count || 0}/{coupon.max_uses || '∞'}</TableCell>
                    <TableCell>{coupon.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>
                      {coupon.is_active ? (
                        <Button size="sm" variant="outline" onClick={() => deactivateMutation.mutate(coupon.id)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CouponsPage;
