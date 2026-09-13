import React, { useState } from 'react';
import type { PatientRecord } from '../lib/types';
import { api } from '../lib/api';
import { UserPlus, X } from 'lucide-react';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientAdmitted: (patient: PatientRecord) => void;
}

export const AdmitPatientModal: React.FC<AdmitPatientModalProps> = ({
  isOpen,
  onClose,
  onPatientAdmitted,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('45');
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [bedNumber, setBedNumber] = useState('403-A');
  const [admissionReason, setAdmissionReason] = useState('');
  const [history, setHistory] = useState('Hypertension, Non-smoker');
  const [notes, setNotes] = useState('Admitted from Emergency Department for observation.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bedNumber) return;

    setIsSubmitting(true);
    try {
      const historyList = history.split(',').map((s) => s.trim()).filter(Boolean);
      const newPatient = await api.addPatient({
        name,
        age: Number(age) || 45,
        gender,
        bedNumber,
        admissionReason: admissionReason || 'Observation & Telemetry Monitoring',
        history: historyList.length > 0 ? historyList : ['No prior medical record'],
        notes: [notes || 'Initial assessment recorded'],
      });

      if (newPatient) {
        onPatientAdmitted(newPatient);
        onClose();
      }
    } catch (err) {
      console.error('Failed to admit patient:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Admit Patient to Ward 4B</h3>
              <p className="text-xs text-slate-400">Register new patient and initiate contactless telemetry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Patient Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sivasankar Raman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Bed Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. 403-A"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Admission Diagnosis / Chief Complaint</label>
            <input
              type="text"
              placeholder="e.g. Acute exacerbation of COPD / Sepsis Watch"
              value={admissionReason}
              onChange={(e) => setAdmissionReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Medical History (Comma-separated)</label>
            <input
              type="text"
              placeholder="Diabetes Type 2, Hypertension, CAD"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Initial Nurse Clinical Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
            ></textarea>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Admitting...' : 'Complete Admission & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
