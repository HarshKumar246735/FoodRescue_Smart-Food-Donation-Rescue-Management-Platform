import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import useCategories from '../../hooks/useCategories.js';
import LocationPicker from '../maps/LocationPicker.jsx';
import { Button, Field } from '../common/ui.jsx';
import { fromLocalInput, toLocalInput } from '../../utils/format.js';

const UNITS = ['kg', 'g', 'lb', 'portions', 'items', 'litres', 'trays', 'boxes'];
const inHours = (h) => toLocalInput(new Date(Date.now() + h * 3600000));

export default function DonationForm({ donation, onSaved }) {
  const nav = useNavigate(); const { categories } = useCategories(); const edit = !!donation;
  const [v, setV] = useState(() => ({
    title: donation?.title || '', category: donation?.category || 'fresh_produce', description: donation?.description || '', quantity: donation?.quantity ?? '', unit: donation?.unit || 'kg', servings: donation?.servings ?? '',
    dietary: donation?.dietary || 'not_applicable', allergens: (donation?.allergens || []).join(', '), preparedAt: toLocalInput(donation?.preparedAt), storage: donation?.storage || 'ambient',
    address: donation?.address || '', city: donation?.city || '', pickupInstructions: donation?.pickupInstructions || '', handlingNotes: donation?.handlingNotes || '',
    availableFrom: toLocalInput(donation?.availableFrom) || toLocalInput(new Date()), pickupDeadline: toLocalInput(donation?.pickupDeadline) || inHours(4), requireVerifiedOrg: donation?.requireVerifiedOrg ?? true, safetyDeclaration: donation?.safetyDeclaration || false,
  }));
  const [loc, setLoc] = useState(donation?.location ? { lat: donation.location.coordinates[1], lng: donation.location.coordinates[0] } : null);
  const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [photo, setPhoto] = useState(null); const [preview, setPreview] = useState(donation?.imageUrl || '');
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const cat = categories.find((c) => c.slug === v.category);
  const err = (k) => errors[k];

  const pickPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast.error('Use a JPEG, PNG or WebP image');
    if (f.size > 5 * 1024 * 1024) return toast.error('Image must be 5 MB or smaller');
    setPhoto(f); setPreview(URL.createObjectURL(f));
  };
  const uploadPhoto = async (id) => { const fd = new FormData(); fd.append('image', photo); await api.post(`/donations/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); };
  const removePhoto = async () => { if (edit && donation.imageUrl && preview === donation.imageUrl) { try { await api.delete(`/donations/${donation._id}/image`); toast.success('Photo removed'); } catch (e) { return toast.error(e.message); } } setPhoto(null); setPreview(''); };

  const submit = async (saveAsDraft) => {
    if (busy) return; setErrors({}); const local = {};
    if (!v.title.trim() || v.title.trim().length < 3) local.title = 'Enter a title of at least 3 characters';
    if (!(Number(v.quantity) > 0)) local.quantity = 'Enter a quantity greater than 0';
    if (!v.address.trim() || v.address.trim().length < 5) local.address = 'Enter the pickup address';
    if (!loc) local.lat = 'Choose the pickup point on the map';
    if (!v.availableFrom) local.availableFrom = 'Required'; if (!v.pickupDeadline) local.pickupDeadline = 'Required';
    if (cat?.requiresPrepTime && !v.preparedAt) local.preparedAt = 'Preparation time is required for this category';
    if (!saveAsDraft && !v.safetyDeclaration) local.safetyDeclaration = 'Confirm the food safety declaration to publish';
    if (Object.keys(local).length) { setErrors(local); toast.error('Please correct the highlighted fields'); return; }
    const body = {
      title: v.title.trim(), category: v.category, description: v.description || undefined, quantity: Number(v.quantity), unit: v.unit, servings: v.servings === '' ? undefined : Number(v.servings),
      dietary: v.dietary, allergens: v.allergens.split(',').map((s) => s.trim()).filter(Boolean), preparedAt: fromLocalInput(v.preparedAt), storage: v.storage, address: v.address.trim(), city: v.city || loc.city || undefined,
      lat: loc.lat, lng: loc.lng, pickupInstructions: v.pickupInstructions || undefined, handlingNotes: v.handlingNotes || undefined, availableFrom: fromLocalInput(v.availableFrom), pickupDeadline: fromLocalInput(v.pickupDeadline),
      requireVerifiedOrg: v.requireVerifiedOrg, safetyDeclaration: v.safetyDeclaration,
    };
    setBusy(true);
    try {
      const res = edit ? await api.patch(`/donations/${donation._id}`, body) : await api.post('/donations', { ...body, saveAsDraft });
      const saved = res.data.data.donation;
      if (photo) { try { await uploadPhoto(saved._id); } catch (e) { toast.error(`Saved, but the photo failed: ${e.message}`); } }
      toast.success(edit ? 'Donation updated' : saveAsDraft ? 'Draft saved' : 'Donation published');
      onSaved ? onSaved(saved) : nav('/donor/donations');
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(false); }} noValidate>
      <section className="card"><h3>What are you donating?</h3>
        <div className="form-grid">
          <Field label="Food title" id="t" error={err('title')} className="full"><input id="t" className="input" value={v.title} onChange={set('title')} aria-invalid={!!err('title')} maxLength={120} placeholder="e.g. 20 vegetable biryani meals" /></Field>
          <Field label="Category" id="c" error={err('category')}><select id="c" className="select" value={v.category} onChange={set('category')}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
          <Field label="Vegetarian / non-vegetarian" id="dt"><select id="dt" className="select" value={v.dietary} onChange={set('dietary')}><option value="not_applicable">Not applicable</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="non_vegetarian">Non-vegetarian</option></select></Field>
          <Field label="Quantity" id="q" error={err('quantity')}><input id="q" className="input" type="number" min="0" step="any" value={v.quantity} onChange={set('quantity')} aria-invalid={!!err('quantity')} /></Field>
          <Field label="Unit" id="u" error={err('unit')}><select id="u" className="select" value={v.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label="Estimated servings (optional)" id="sv"><input id="sv" className="input" type="number" min="0" value={v.servings} onChange={set('servings')} /></Field>
          <Field label="Allergens (comma separated)" id="al" hint="e.g. nuts, dairy, gluten"><input id="al" className="input" value={v.allergens} onChange={set('allergens')} /></Field>
          <Field label="Description" id="d" className="full" error={err('description')}><textarea id="d" className="textarea" value={v.description} onChange={set('description')} maxLength={1000} /></Field>
          <div className="full"><div className="label" style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 6 }}>Photograph</div>
            <div className="photo-up">{preview ? <img className="preview" src={preview} alt="Selected food" /> : <div className="preview" aria-hidden="true" />}
              <label className="btn btn-secondary"><ImagePlus size={16} />{preview ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="sr-only" /></label>
              {preview && <button type="button" className="btn btn-ghost" onClick={removePhoto}><Trash2 size={16} />Remove</button>}</div>
            <span className="hint">JPEG, PNG or WebP up to 5 MB. A clear photo helps organizations decide quickly.</span></div>
        </div>
      </section>

      <section className="card"><h3>Food safety details</h3>
        <div className="form-grid">
          <Field label={`Prepared or packed at${cat?.requiresPrepTime ? '' : ' (optional)'}`} id="pa" error={err('preparedAt')}><input id="pa" className="input" type="datetime-local" value={v.preparedAt} onChange={set('preparedAt')} aria-invalid={!!err('preparedAt')} /></Field>
          <Field label="Storage" id="st"><select id="st" className="select" value={v.storage} onChange={set('storage')}><option value="ambient">Room temperature</option><option value="refrigerated">Refrigerated</option><option value="frozen">Frozen</option><option value="hot_held">Kept hot</option></select></Field>
          <Field label="Handling notes" id="hn" className="full"><textarea id="hn" className="textarea" value={v.handlingNotes} onChange={set('handlingNotes')} maxLength={500} placeholder="Reheating, packaging, temperature…" /></Field>
        </div>
      </section>

      <section className="card"><h3>Pickup</h3>
        <div className="form-grid">
          <Field label="Available from" id="af" error={err('availableFrom')}><input id="af" className="input" type="datetime-local" value={v.availableFrom} onChange={set('availableFrom')} /></Field>
          <Field label="Pickup deadline" id="pd" error={err('pickupDeadline')}><input id="pd" className="input" type="datetime-local" value={v.pickupDeadline} onChange={set('pickupDeadline')} aria-invalid={!!err('pickupDeadline')} /></Field>
          <Field label="Pickup address" id="ad" className="full" error={err('address')} hint="Shown only to the organization and volunteer once a request is accepted."><input id="ad" className="input" value={v.address} onChange={set('address')} aria-invalid={!!err('address')} /></Field>
          <Field label="City or area (shown publicly)" id="ci"><input id="ci" className="input" value={v.city} onChange={set('city')} maxLength={80} /></Field>
          <Field label="Pickup instructions" id="pi" error={err('pickupInstructions')}><input id="pi" className="input" value={v.pickupInstructions} onChange={set('pickupInstructions')} placeholder="Ask for the manager, back entrance…" /></Field>
          <div className="full"><LocationPicker value={loc} onChange={setLoc} error={err('lat')} /></div>
          <label className="check full"><input type="checkbox" checked={v.requireVerifiedOrg} onChange={set('requireVerifiedOrg')} /><span>Only accept requests from verified organizations</span></label>
        </div>
      </section>

      <section className="card"><label className="check"><input type="checkbox" checked={v.safetyDeclaration} onChange={set('safetyDeclaration')} aria-invalid={!!err('safetyDeclaration')} />
        <span>I declare this food was prepared, stored and packed safely, the details above are accurate, and I will follow my local food-safety rules. FoodRescue does not certify food as safe.</span></label>
        {err('safetyDeclaration') && <span className="field-error" role="alert">{err('safetyDeclaration')}</span>}</section>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {(!edit || donation.status === 'draft') && <Button type="button" variant="secondary" loading={busy} onClick={() => submit(true)}>{edit ? 'Save draft' : 'Save as draft'}</Button>}
        {(!edit || donation.status !== 'draft') && <Button type="submit" loading={busy}>{edit ? 'Save changes' : 'Publish donation'}</Button>}
      </div>
    </form>
  );
}
