import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WardPatientRadarState } from '../types/radar';
import { apiUrl } from '../lib/api';

interface AdminPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CREATE' | 'EDIT';
  initialPatient?: WardPatientRadarState | null;
  onSuccess: (patient: WardPatientRadarState) => void;
  onDelete?: (patientId: string) => void;
}

export const AdminPatientModal: React.FC<AdminPatientModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialPatient,
  onSuccess,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [mrn, setMrn] = useState('');
  const [age, setAge] = useState<number>(65);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [bedNumber, setBedNumber] = useState('401-A');
  const [wardId, setWardId] = useState('WARD-A');
  const [admissionDiagnosis, setAdmissionDiagnosis] = useState('');
  const [attendingPhysician, setAttendingPhysician] = useState('Dr. Sarah Lin, MD');
  const [primaryNurse, setPrimaryNurse] = useState('Nurse Rachel Hayes, RN');
  const [codeStatus, setCodeStatus] = useState<'FULL_CODE' | 'DNR' | 'DNI'>('FULL_CODE');
  const [baselineMEWS, setBaselineMEWS] = useState<number>(0);
  const [allergiesInput, setAllergiesInput] = useState('');
  const [isolationStatus, setIsolationStatus] = useState<'NONE' | 'DROPLET' | 'CONTACT' | 'AIRBORNE'>('NONE');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (mode === 'EDIT' && initialPatient) {
      setName(initialPatient.name);
      setMrn(initialPatient.mrn);
      setAge(initialPatient.age);
      setGender(initialPatient.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
      setBedNumber(initialPatient.bedNumber);
      setWardId('WARD-A');
      setAdmissionDiagnosis(initialPatient.admissionDiagnosis);
      setAttendingPhysician(initialPatient.attendingPhysician || 'Dr. Sarah Lin, MD');
      setPrimaryNurse(initialPatient.primaryNurse || 'Nurse Rachel Hayes, RN');
      setCodeStatus(initialPatient.codeStatus || 'FULL_CODE');
      setBaselineMEWS(initialPatient.mews?.totalScore ?? 0);
      setAllergiesInput(initialPatient.allergies ? initialPatient.allergies.join(', ') : '');
      setIsolationStatus(initialPatient.isolationStatus || 'NONE');
    } else {
      // Defaults for new admission
      setName('');
      setMrn(`MRN-${Math.floor(10000 + Math.random() * 90000)}`);
      setAge(62);
      setGender('MALE');
      setBedNumber('406-A');
      setWardId('WARD-A');
      setAdmissionDiagnosis('');
      setAttendingPhysician('Dr. Sarah Lin, MD');
      setPrimaryNurse('Nurse Rachel Hayes, RN');
      setCodeStatus('FULL_CODE');
      setBaselineMEWS(0);
      setAllergiesInput('NKDA');
      setIsolationStatus('NONE');
    }
    setErrorMsg(null);
    setIsConfirmingDelete(false);
  }, [mode, initialPatient, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const token = localStorage.getItem('aegis-admin-token') || 'admin-token';
    const allergies = allergiesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (mode === 'CREATE') {
        const payload = {
          name,
          mrn: mrn || `MRN-${Math.floor(10000 + Math.random() * 90000)}`,
          age: Number(age),
          gender,
          wardId,
          bedNumber,
          admissionDiagnosis,
          attendingPhysician,
          primaryNurse,
          codeStatus,
          baselineMEWS: Number(baselineMEWS),
          allergies,
          isolationStatus,
        };

        const res = await fetch(apiUrl('/api/v1/patients'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to admit patient');
        }

        const resData = await res.json();
        const created = resData.data;

        const codeStat: 'FULL_CODE' | 'DNR' | 'DNI' =
          codeStatus === 'DNR' ? 'DNR' : codeStatus === 'DNI' ? 'DNI' : 'FULL_CODE';
        const isoStat: 'NONE' | 'DROPLET' | 'CONTACT' | 'AIRBORNE' =
          isolationStatus === 'DROPLET'
            ? 'DROPLET'
            : isolationStatus === 'CONTACT'
            ? 'CONTACT'
            : isolationStatus === 'AIRBORNE'
            ? 'AIRBORNE'
            : 'NONE';

        const clinicalCodeStat: 'FULL_CODE' | 'DNR_DNI' | 'DNR' | 'LIMITED_INTERVENTION' =
          codeStatus === 'DNR' ? 'DNR' : codeStatus === 'DNI' ? 'DNR_DNI' : 'FULL_CODE';

        // Map to WardPatientRadarState for local state
        const newRadarPatient: WardPatientRadarState = {
          patientId: created.id,
          bedNumber: created.bedNumber,
          roomNumber: created.bedNumber.split('-')[0] || '400',
          mrn: created.mrn,
          name: created.name,
          age: created.age,
          gender: created.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
          admissionDiagnosis: created.admissionDiagnosis,
          admissionDate: new Date().toISOString(),
          attendingPhysician: created.attendingPhysician,
          primaryNurse: created.primaryNurse,
          codeStatus: codeStat,
          allergies: created.allergies || [],
          isolationStatus: isoStat,
          apsScore: 18,
          category: 'LOW',
          categoryRank: 99,
          trendDirection: 'STEADY',
          trendVelocityPointsPerHour: 0.2,
          whyNowSummary: 'Recently admitted patient. Initial vital observations within normal baseline.',
          topContributingReasons: [],
          mews: {
            totalScore: Number(baselineMEWS),
            thresholdRisk: Number(baselineMEWS) >= 5 ? 'HIGH' : Number(baselineMEWS) >= 3 ? 'MEDIUM' : 'LOW',
            breakdown: [],
          },
          vitals: {
            heartRate: 75,
            heartRateBaseline: 75,
            respiratoryRate: 16,
            respiratoryRateBaseline: 16,
            spo2: 98,
            spo2Baseline: 98,
            systolicBP: 120,
            systolicBPBaseline: 120,
            diastolicBP: 80,
            meanArterialPressure: 93,
            bodyTemperature: 36.8,
            shockIndex: 0.63,
            avpu: 'ALERT',
            oxygenDelivery: 'Room Air',
          },
          signalQuality: {
            confidencePercent: 98,
            snrDb: 18,
            motionMagnitude: 0.05,
            motionDetected: false,
            illuminationLux: 350,
            opticalLineOfSight: true,
            cameraDeviceId: 'CAM-DEFAULT',
            lastFrameProcessedIso: new Date().toISOString(),
            privacyNotice: 'Transient volatile RAM processing only. Zero frames persisted.',
          },
          trajectory: [],
          lastTrustedObservationIso: new Date().toISOString(),
          lastTrustedElapsedMinutes: 0,
          isStale: false,
          clinicalContext: {
            id: `ctx-${created.id}`,
            patientId: created.id,
            admissionReason: created.admissionDiagnosis,
            codeStatus: clinicalCodeStat,
            isolationStatus: isoStat,
            baselineMEWS: Number(baselineMEWS),
            comorbidities: [],
            oxygenDelivery: 'ROOM_AIR',
            updatedAt: Date.now(),
          },
          labs: [],
          recommendedVerifications: [],
          timeline: [],
          isAcknowledged: true,
        };

        onSuccess(newRadarPatient);
        onClose();
      } else if (mode === 'EDIT' && initialPatient) {
        const codeStat: 'FULL_CODE' | 'DNR' | 'DNI' =
          codeStatus === 'DNR' ? 'DNR' : codeStatus === 'DNI' ? 'DNI' : 'FULL_CODE';
        const isoStat: 'NONE' | 'DROPLET' | 'CONTACT' | 'AIRBORNE' =
          isolationStatus === 'DROPLET'
            ? 'DROPLET'
            : isolationStatus === 'CONTACT'
            ? 'CONTACT'
            : isolationStatus === 'AIRBORNE'
            ? 'AIRBORNE'
            : 'NONE';

        const payload = {
          name,
          age: Number(age),
          gender,
          bedNumber,
          admissionDiagnosis,
          attendingPhysician,
          primaryNurse,
          codeStatus,
          baselineMEWS: Number(baselineMEWS),
          allergies,
          isolationStatus,
        };

        const res = await fetch(apiUrl(`/api/v1/patients/${initialPatient.patientId}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to update patient');
        }

        const updatedRadarPatient: WardPatientRadarState = {
          ...initialPatient,
          name,
          age: Number(age),
          gender: gender === 'FEMALE' ? 'FEMALE' : 'MALE',
          bedNumber,
          admissionDiagnosis,
          attendingPhysician,
          primaryNurse,
          codeStatus: codeStat,
          allergies,
          isolationStatus: isoStat,
          mews: {
            ...initialPatient.mews,
            totalScore: Number(baselineMEWS),
          },
        };

        onSuccess(updatedRadarPatient);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed. Check network or admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialPatient) return;
    setIsLoading(true);
    setErrorMsg(null);

    const token = localStorage.getItem('aegis-admin-token') || 'admin-token';

    try {
      const res = await fetch(apiUrl(`/api/v1/patients/${initialPatient.patientId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to discharge patient');
      }

      if (onDelete) {
        onDelete(initialPatient.patientId);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Discharge failed. Check network or admin permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400">
              {mode === 'CREATE' ? <UserPlus className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {mode === 'CREATE' ? 'Admit Patient to Ward' : `Edit Patient: ${initialPatient?.name}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'CREATE' ? 'Provision Bed & Clinical Baseline Record' : `ID: ${initialPatient?.patientId} · MRN: ${initialPatient?.mrn}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Core Demographics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Arthur Pendelton"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">MRN</label>
              <input
                type="text"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                placeholder="MRN-XXXXX"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 dark:text-white text-xs"
                disabled={mode === 'EDIT'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Age</label>
              <input
                type="number"
                min="0"
                max="125"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 dark:text-white text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Bed Number</label>
              <input
                type="text"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                placeholder="e.g. 405-A"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold text-slate-900 dark:text-white text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Ward</label>
              <input
                type="text"
                value={wardId}
                disabled
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Clinical Context */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Admission Diagnosis <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={admissionDiagnosis}
              onChange={(e) => setAdmissionDiagnosis(e.target.value)}
              placeholder="e.g. Post-Op Day 1 Right Hemicolectomy, Occult Sepsis Watch"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Attending Physician
              </label>
              <input
                type="text"
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Primary Nurse
              </label>
              <input
                type="text"
                value={primaryNurse}
                onChange={(e) => setPrimaryNurse(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Code Status</label>
              <select
                value={codeStatus}
                onChange={(e) => setCodeStatus(e.target.value as 'FULL_CODE' | 'DNR' | 'DNI')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              >
                <option value="FULL_CODE">Full Code (Resuscitate)</option>
                <option value="DNR">DNR (Do Not Resuscitate)</option>
                <option value="DNI">DNI (Do Not Intubate)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Baseline MEWS</label>
              <input
                type="number"
                min="0"
                max="14"
                value={baselineMEWS}
                onChange={(e) => setBaselineMEWS(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 dark:text-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Isolation Status</label>
              <select
                value={isolationStatus}
                onChange={(e) => setIsolationStatus(e.target.value as 'NONE' | 'DROPLET' | 'CONTACT' | 'AIRBORNE')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
              >
                <option value="NONE">Standard / None</option>
                <option value="CONTACT">Contact Precautions</option>
                <option value="DROPLET">Droplet Precautions</option>
                <option value="AIRBORNE">Airborne Isolation</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Allergies (comma-separated)
            </label>
            <input
              type="text"
              value={allergiesInput}
              onChange={(e) => setAllergiesInput(e.target.value)}
              placeholder="e.g. Penicillin, Latex, Sulfa drugs, NKDA"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-900 dark:text-white text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              {mode === 'EDIT' && (
                isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-bold text-xs">Discharge Patient?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="font-bold text-xs"
                    >
                      Confirm Discharge
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800 gap-1.5 font-bold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discharge Patient
                  </Button>
                )
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="font-semibold">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-600 dark:text-slate-950 font-bold"
              >
                {isLoading ? 'Saving...' : mode === 'CREATE' ? 'Admit Patient' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
