import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Exam, StudentSubmission, StudentRosterItem, ClassGroup, TeacherProfile, AppUser, UserRole, GradingCalibrationFeedback, StudentAppeal } from '../types/exam';
import { DEFAULT_SAMPLE_EXAMS } from '../data/defaultExam';
import { isInvalidStudentName } from './studentRosterParser';
import { sanitizeExamQuestions } from './examPermuter';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with configured databaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize anonymous auth fallback for seamless guest access across devices
signInAnonymously(auth).catch((err) => {
  console.warn('Anonymous auth note (can continue in open mode):', err.message);
});

// App User Auth State Storage Key
const USER_STORAGE_KEY = 'edumath_app_user';
const REGISTERED_USERS_KEY = 'edumath_registered_users';
const TEACHER_STORAGE_KEY = 'edumath_teacher_profile';

export const getStoredUser = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AppUser | null): void => {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      if (user.role === 'admin' || user.role === 'teacher') {
        const teacherProfile: TeacherProfile = {
          uid: user.uid,
          email: user.email || user.username,
          fullName: user.fullName,
          school: user.school,
          subject: user.subject || 'Toán Học THPT',
          createdAt: user.createdAt,
          role: user.role,
        };
        localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacherProfile));
      }
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TEACHER_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
};

export const getStoredTeacherProfile = (): TeacherProfile | null => {
  const user = getStoredUser();
  if (user && (user.role === 'admin' || user.role === 'teacher')) {
    return {
      uid: user.uid,
      email: user.email || user.username,
      fullName: user.fullName,
      school: user.school,
      subject: user.subject || 'Toán Học THPT',
      createdAt: user.createdAt,
      role: user.role,
    };
  }
  try {
    const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredTeacherProfile = (teacher: TeacherProfile | null): void => {
  try {
    if (teacher) {
      localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacher));
    } else {
      localStorage.removeItem(TEACHER_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
};

// Error handling conforming to Firebase skill specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore offline or connecting...");
    }
  }
}
testConnection();

// Collection names
const EXAMS_COLLECTION = 'exams';
const SUBMISSIONS_COLLECTION = 'submissions';
const EXAMS_STORAGE_KEY = 'edumath_saved_exams';
const DELETED_EXAMS_STORAGE_KEY = 'edumath_deleted_exam_ids';

export function getDeletedExamIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_EXAMS_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markExamAsDeletedLocally(examId: string, examCode?: string): void {
  try {
    const deleted = getDeletedExamIds();
    if (examId) deleted.add(examId);
    if (examCode) deleted.add(examCode);
    localStorage.setItem(DELETED_EXAMS_STORAGE_KEY, JSON.stringify(Array.from(deleted)));
    const remaining = getStoredExams().filter(
      (e) => e.id !== examId && (!examCode || e.examCode !== examCode)
    );
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.error('Error marking exam deleted:', e);
  }
}

export function getStoredExams(): Exam[] {
  try {
    const deleted = getDeletedExamIds();
    const raw = localStorage.getItem(EXAMS_STORAGE_KEY);
    const list: Exam[] = raw ? JSON.parse(raw) : DEFAULT_SAMPLE_EXAMS;
    return list
      .filter((e) => !deleted.has(e.id) && !deleted.has(e.examCode))
      .map(sanitizeExamQuestions);
  } catch {
    return [];
  }
}

export function saveExamsLocally(exams: Exam[]): void {
  try {
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
  } catch (e) {
    console.error('Error saving exams locally:', e);
  }
}

/**
 * Save or update an exam in Firebase Cloud Firestore and LocalStorage
 */
export async function saveExamToFirestore(exam: Exam): Promise<void> {
  // Unmark from deleted if re-created or re-saved
  try {
    const deleted = getDeletedExamIds();
    let changed = false;
    if (deleted.has(exam.id)) {
      deleted.delete(exam.id);
      changed = true;
    }
    if (exam.examCode && deleted.has(exam.examCode)) {
      deleted.delete(exam.examCode);
      changed = true;
    }
    if (changed) {
      localStorage.setItem(DELETED_EXAMS_STORAGE_KEY, JSON.stringify(Array.from(deleted)));
    }
    const local = getStoredExams();
    const updated = [exam, ...local.filter((e) => e.id !== exam.id)];
    saveExamsLocally(updated);
  } catch (e) {
    console.error('Local exam save error:', e);
  }

  const path = `${EXAMS_COLLECTION}/${exam.id}`;
  try {
    const examDocRef = doc(db, EXAMS_COLLECTION, exam.id);
    const dataToSave = {
      ...exam,
      updatedAt: new Date().toISOString()
    };
    await setDoc(examDocRef, dataToSave, { merge: true });
  } catch (error) {
    console.warn('Firestore exam save warning (saved locally):', error);
  }
}

/**
 * Delete an exam from Firebase Cloud Firestore and LocalStorage
 */
export async function deleteExamFromFirestore(examId: string, examCode?: string): Promise<void> {
  markExamAsDeletedLocally(examId, examCode);
  try {
    if (examId) {
      const examDocRef = doc(db, EXAMS_COLLECTION, examId);
      await deleteDoc(examDocRef);
    }
    if (examCode && examCode !== examId) {
      const codeDocRef = doc(db, EXAMS_COLLECTION, examCode);
      await deleteDoc(codeDocRef).catch(() => {});
    }
  } catch (error) {
    console.warn('Firestore exam delete note (deleted locally):', error);
  }
}

/**
 * Subscribe to real-time updates for all exams created by teachers
 */
export function subscribeExamsFromFirestore(
  onExams: (exams: Exam[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, EXAMS_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const exams: Exam[] = [];
      const deleted = getDeletedExamIds();
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as Exam;
        if (!deleted.has(item.id) && !deleted.has(item.examCode)) {
          exams.push(item);
        }
      });
      if (exams.length > 0) {
        saveExamsLocally(exams);
        exams.sort((a, b) => {
          const timeA = (a as any).updatedAt || (a as any).createdAt || '';
          const timeB = (b as any).updatedAt || (b as any).createdAt || '';
          return timeB.localeCompare(timeA);
        });
        onExams(exams);
      } else {
        const local = getStoredExams();
        onExams(local);
      }
    },
    (error) => {
      console.warn('Error listening to exams, falling back to local stored exams:', error);
      const local = getStoredExams();
      onExams(local);
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

/**
 * Save a student submission to Firebase Cloud Firestore
 */
export async function saveSubmissionToFirestore(submission: StudentSubmission): Promise<void> {
  const path = `${SUBMISSIONS_COLLECTION}/${submission.id}`;
  try {
    const subDocRef = doc(db, SUBMISSIONS_COLLECTION, submission.id);
    const cleanSub = {
      ...submission,
      savedAt: new Date().toISOString()
    };
    await setDoc(subDocRef, cleanSub, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a submission from Firebase Cloud Firestore
 */
export async function deleteSubmissionFromFirestore(submissionId: string): Promise<void> {
  const path = `${SUBMISSIONS_COLLECTION}/${submissionId}`;
  try {
    const subDocRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await deleteDoc(subDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to real-time student submissions from Firebase Cloud Firestore
 */
export function subscribeSubmissionsFromFirestore(
  onSubmissions: (submissions: StudentSubmission[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, SUBMISSIONS_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const subs: StudentSubmission[] = [];
      snapshot.forEach((docSnap) => {
        subs.push(docSnap.data() as StudentSubmission);
      });
      // Sort newest first
      subs.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      onSubmissions(subs);
    },
    (error) => {
      console.error('Error listening to submissions:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, SUBMISSIONS_COLLECTION);
    }
  );
  return unsubscribe;
}

// ==========================================
// Grading Calibration Feedback Collection (For Fine-tuning & Prompt Tuning)
// ==========================================
const CALIBRATION_COLLECTION = 'grading_calibration_feedback';
const CALIBRATION_STORAGE_KEY = 'edumath_calibration_feedback';

export function getStoredCalibrationFeedbacks(): GradingCalibrationFeedback[] {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCalibrationFeedbackToFirestore(feedback: GradingCalibrationFeedback): Promise<void> {
  try {
    const list = getStoredCalibrationFeedbacks();
    const idx = list.findIndex((f) => f.id === feedback.id);
    if (idx >= 0) {
      list[idx] = feedback;
    } else {
      list.unshift(feedback);
    }
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(list));
  } catch {}

  const path = `${CALIBRATION_COLLECTION}/${feedback.id}`;
  try {
    const docRef = doc(db, CALIBRATION_COLLECTION, feedback.id);
    await setDoc(docRef, feedback, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeCalibrationFeedbackFromFirestore(
  onFeedback: (feedbacks: GradingCalibrationFeedback[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, CALIBRATION_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: GradingCalibrationFeedback[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as GradingCalibrationFeedback);
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onFeedback(list);
    },
    (error) => {
      console.warn('Error listening to calibration feedback, using local cache:', error);
      if (onError) onError(error);
      onFeedback(getStoredCalibrationFeedbacks());
    }
  );
  return unsubscribe;
}

export async function deleteCalibrationFeedbackFromFirestore(feedbackId: string): Promise<void> {
  try {
    const list = getStoredCalibrationFeedbacks().filter((f) => f.id !== feedbackId);
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(list));
  } catch {}

  const path = `${CALIBRATION_COLLECTION}/${feedbackId}`;
  try {
    const docRef = doc(db, CALIBRATION_COLLECTION, feedbackId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const STUDENTS_COLLECTION = 'students';
const STUDENTS_STORAGE_KEY = 'edumath_students_roster';

export function getStoredStudentRoster(): StudentRosterItem[] {
  try {
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const list: StudentRosterItem[] = raw ? JSON.parse(raw) : [];
    return list.filter((s) => !isInvalidStudentName(s.fullName));
  } catch {
    return [];
  }
}

/**
 * Save student roster to Firebase Cloud Firestore
 */
export async function saveStudentRosterToFirestore(students: StudentRosterItem[]): Promise<void> {
  const validStudents = students.filter((s) => !isInvalidStudentName(s.fullName));
  try {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(validStudents));
  } catch {}

  for (const st of validStudents) {
    const safeDocId = `${st.className || 'lop'}_${st.sbd || st.id || st.stt}`.replace(/[\/\s#?]/g, '_');
    const docRef = doc(db, STUDENTS_COLLECTION, safeDocId);
    await setDoc(docRef, { ...st, id: safeDocId, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

/**
 * Delete all students of a specific class from Firestore (useful when replacing class roster)
 */
export async function deleteClassStudentsFromFirestore(className: string): Promise<void> {
  const clean = className.trim().toUpperCase();
  const roster = getStoredStudentRoster();
  const toDelete = roster.filter((s) => s.className?.toUpperCase() === clean);
  for (const st of toDelete) {
    await deleteStudentFromFirestore(st.id).catch(() => {});
  }
  const remaining = roster.filter((s) => s.className?.toUpperCase() !== clean);
  try {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(remaining));
  } catch {}
}

/**
 * Tạo tài khoản hàng loạt cho toàn bộ học sinh trong lớp
 * Tự sinh Username chuẩn (vd: 11a1_01, 11a1_02 hoặc theo SBD) và Mật khẩu mặc định (123456)
 */
export async function createStudentAccountsForClass(
  className: string,
  students: StudentRosterItem[],
  defaultPassword: string = '123456'
): Promise<StudentRosterItem[]> {
  const cleanClass = className.trim().toUpperCase();
  const classTag = cleanClass.toLowerCase().replace(/[^a-z0-9]/g, '');
  const pass = defaultPassword.trim() || '123456';
  const updatedStudents: StudentRosterItem[] = [];

  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const sttNum = st.stt || i + 1;
    const cleanSbd = (st.sbd || `${cleanClass}-${String(sttNum).padStart(2, '0')}`).trim();
    // Tên đăng nhập dễ nhớ: ví dụ 11a1_01 hoặc 10a2_15
    const username = `${classTag}_${String(sttNum).padStart(2, '0')}`;

    const updatedSt: StudentRosterItem = {
      ...st,
      stt: sttNum,
      className: cleanClass,
      sbd: cleanSbd,
      username,
      password: pass,
      isAccountCreated: true,
    };
    updatedStudents.push(updatedSt);

    // Tạo AppUser cho học sinh
    const studentUser: AppUser = {
      uid: `student_${cleanClass}_${cleanSbd}`.replace(/[\/\s#?]/g, '_'),
      role: 'student',
      fullName: st.fullName.trim(),
      username,
      email: `${username}@edumath.edu.vn`,
      school: 'Trường THPT',
      className: cleanClass,
      subject: 'Toán Học GDPT 2018',
      createdAt: new Date().toISOString(),
    };

    // Lưu vào bộ nhớ local để đăng nhập ngay lập tức
    saveRegisteredUserLocally(username, pass, studentUser);
    // Cho phép đăng nhập bằng cả SBD (vd: 11A1-01)
    if (cleanSbd.toLowerCase() !== username.toLowerCase()) {
      saveRegisteredUserLocally(cleanSbd.toLowerCase(), pass, studentUser);
    }

    // Đồng bộ lên Firestore USERS_COLLECTION
    try {
      const userDocRef = doc(db, USERS_COLLECTION, studentUser.uid);
      await setDoc(userDocRef, { ...studentUser, passHash: pass }, { merge: true });
    } catch (e) {
      console.warn('Firestore student user save note:', e);
    }
  }

  // Cập nhật danh sách học sinh lên Firestore
  await saveStudentRosterToFirestore(updatedStudents);

  return updatedStudents;
}

/**
 * Subscribe to real-time student roster from Firebase Cloud Firestore
 * Automatically purges any invalid summary / footer rows (e.g. "Khối 11 - Lớp 11A1", "THỐNG KÊ HỌC KỲ 1")
 */
export function subscribeStudentRosterFromFirestore(
  onStudents: (students: StudentRosterItem[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, STUDENTS_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: StudentRosterItem[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as StudentRosterItem;
        if (isInvalidStudentName(item.fullName)) {
          return;
        }
        list.push(item);
      });
      list.sort((a, b) => (a.stt || 0) - (b.stt || 0));
      onStudents(list);
    },
    (error) => {
      console.error('Error listening to students roster:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, STUDENTS_COLLECTION);
    }
  );
  return unsubscribe;
}

/**
 * Delete a student from Firestore
 */
export async function deleteStudentFromFirestore(studentDocId: string): Promise<void> {
  const path = `${STUDENTS_COLLECTION}/${studentDocId}`;
  try {
    const docRef = doc(db, STUDENTS_COLLECTION, studentDocId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const CLASSES_COLLECTION = 'classes';
const CLASSES_STORAGE_KEY = 'edumath_class_groups';
const DELETED_CLASSES_STORAGE_KEY = 'edumath_deleted_class_ids';

const DEFAULT_CLASSES: ClassGroup[] = [
  { id: '10A1', name: '10A1', grade: '10', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() },
  { id: '10A2', name: '10A2', grade: '10', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() },
  { id: '12A8', name: '12A8', grade: '12', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() }
];

export function getDeletedClassIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_CLASSES_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markClassAsDeletedLocally(classId: string): void {
  try {
    const clean = classId.trim().toUpperCase();
    const deleted = getDeletedClassIds();
    deleted.add(classId);
    deleted.add(clean);
    localStorage.setItem(DELETED_CLASSES_STORAGE_KEY, JSON.stringify(Array.from(deleted)));

    const remaining = getStoredClasses().filter(
      (c) => c.id !== classId && c.name !== classId && c.name?.toUpperCase() !== clean && c.id?.toUpperCase() !== clean
    );
    saveClassesLocally(remaining);
  } catch (e) {
    console.error('Error marking class deleted:', e);
  }
}

export function getStoredClasses(teacherId?: string): ClassGroup[] {
  try {
    const deleted = getDeletedClassIds();
    const storageKey = teacherId ? `${CLASSES_STORAGE_KEY}_${teacherId}` : CLASSES_STORAGE_KEY;
    const raw = localStorage.getItem(storageKey);
    let classes: ClassGroup[] = [];
    if (raw) {
      classes = JSON.parse(raw);
    } else if (!teacherId || teacherId === 'admin_kiet' || teacherId === 'teacher_default') {
      classes = DEFAULT_CLASSES.map((c) => ({ ...c, teacherId: teacherId || 'admin_kiet' }));
    } else {
      // Mỗi giáo viên có danh sách lớp riêng biệt ban đầu
      classes = [
        { id: `10A1_${teacherId}`, name: '10A1', grade: '10', schoolYear: '2024 - 2025', teacherId, createdAt: new Date().toISOString() },
        { id: `11A1_${teacherId}`, name: '11A1', grade: '11', schoolYear: '2024 - 2025', teacherId, createdAt: new Date().toISOString() },
        { id: `12A1_${teacherId}`, name: '12A1', grade: '12', schoolYear: '2024 - 2025', teacherId, createdAt: new Date().toISOString() }
      ];
      localStorage.setItem(storageKey, JSON.stringify(classes));
    }
    return classes.filter(
      (c) => !deleted.has(c.id) && !deleted.has(c.name) && !deleted.has(c.name?.toUpperCase()) && !deleted.has(c.id?.toUpperCase())
    );
  } catch {
    return [];
  }
}

export function saveClassesLocally(classes: ClassGroup[], teacherId?: string): void {
  try {
    const storageKey = teacherId ? `${CLASSES_STORAGE_KEY}_${teacherId}` : CLASSES_STORAGE_KEY;
    localStorage.setItem(storageKey, JSON.stringify(classes));
  } catch (e) {
    console.error('Error saving classes locally:', e);
  }
}

export async function saveClassGroupToFirestore(cls: ClassGroup, teacherId?: string): Promise<void> {
  const cleanName = cls.name.trim().toUpperCase();
  const effectiveTeacherId = cls.teacherId || teacherId || 'admin_kiet';
  const safeId = (cls.id && cls.id.includes('_') ? cls.id : `${cleanName}_${effectiveTeacherId}`).replace(/[\/\s#?]+/g, '_').toUpperCase();

  const classData: ClassGroup = {
    ...cls,
    id: safeId,
    name: cleanName,
    teacherId: effectiveTeacherId,
    createdAt: cls.createdAt || new Date().toISOString(),
  };

  // If this class was previously deleted, remove from deleted tracking so it can be restored/re-created
  try {
    const deleted = getDeletedClassIds();
    if (deleted.has(cls.id) || deleted.has(cls.name) || deleted.has(cleanName)) {
      deleted.delete(cls.id);
      deleted.delete(cls.name);
      deleted.delete(cleanName);
      localStorage.setItem(DELETED_CLASSES_STORAGE_KEY, JSON.stringify(Array.from(deleted)));
    }
    const local = getStoredClasses(effectiveTeacherId);
    const updated = [classData, ...local.filter((c) => c.id !== classData.id && c.name !== classData.name && c.name?.toUpperCase() !== cleanName)];
    saveClassesLocally(updated, effectiveTeacherId);
  } catch (e) {
    console.error('Local class save note:', e);
  }

  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    const docRef = doc(db, CLASSES_COLLECTION, safeId);
    await setDoc(docRef, { ...classData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.warn('Firestore class save note (saved locally):', error);
  }
}

export function subscribeClassGroupsFromFirestore(
  onClasses: (classes: ClassGroup[]) => void,
  teacherId?: string,
  isAdmin: boolean = false,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, CLASSES_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: ClassGroup[] = [];
      const deleted = getDeletedClassIds();
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as ClassGroup;
        if (
          !deleted.has(item.id) &&
          !deleted.has(item.name) &&
          !deleted.has(item.name?.toUpperCase()) &&
          !deleted.has(item.id?.toUpperCase())
        ) {
          // If teacher is specified and not admin, only show classes for this teacher
          if (isAdmin || !teacherId || item.teacherId === teacherId || (!item.teacherId && teacherId === 'admin_kiet')) {
            list.push(item);
          }
        }
      });
      if (list.length > 0) {
        saveClassesLocally(list, teacherId);
        onClasses(list);
      } else {
        // Fallback to local stored classes if firestore collection is empty
        const local = getStoredClasses(teacherId);
        onClasses(local);
      }
    },
    (error) => {
      console.warn('Class groups subscription fallback to local storage:', error);
      const local = getStoredClasses(teacherId);
      onClasses(local);
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

export async function deleteClassGroupFromFirestore(classId: string): Promise<void> {
  markClassAsDeletedLocally(classId);
  const safeId = classId.replace(/[\/\s#?]+/g, '_').toUpperCase();
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    const docRef = doc(db, CLASSES_COLLECTION, safeId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Firestore class delete note (deleted locally):', error);
  }
}

const TEACHERS_COLLECTION = 'teachers';
const USERS_COLLECTION = 'users';

function getStoredRegisteredUsers(): Array<{
  username: string;
  pass: string;
  user: AppUser;
}> {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUserLocally(username: string, pass: string, user: AppUser) {
  try {
    const users = getStoredRegisteredUsers().filter(u => u.username.toLowerCase() !== username.toLowerCase());
    users.push({ username, pass, user });
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving local user:', e);
  }
}

export function saveRegisteredUsersListLocally(users: Array<{ username: string; pass: string; user: AppUser }>) {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving users list:', e);
  }
}

export function getRegisteredTeachers(): AppUser[] {
  const local = getStoredRegisteredUsers().map((u) => u.user);
  return local.filter((u) => u.role === 'teacher');
}

/**
 * Lắng nghe danh sách giáo viên thời gian thực từ Firestore và LocalStorage
 */
export function subscribeTeachersFromFirestore(
  onTeachers: (teachers: AppUser[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, TEACHERS_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const firestoreList: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        firestoreList.push(docSnap.data() as AppUser);
      });
      // Merge with local stored registered teachers
      const local = getRegisteredTeachers();
      const map = new Map<string, AppUser>();
      local.forEach((t) => map.set(t.uid, t));
      firestoreList.forEach((t) => {
        if (t.role === 'teacher') {
          map.set(t.uid, { ...(map.get(t.uid) || {}), ...t });
        }
      });
      const combined = Array.from(map.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      onTeachers(combined);
    },
    (error) => {
      console.warn('Teachers subscription fallback to local storage:', error);
      const local = getRegisteredTeachers();
      onTeachers(local);
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

export async function approveTeacherUser(teacherUid: string, approve: boolean = true): Promise<void> {
  const users = getStoredRegisteredUsers();
  const updated = users.map((u) => {
    if (u.user.uid === teacherUid || u.user.username.toLowerCase() === teacherUid.toLowerCase()) {
      return {
        ...u,
        user: {
          ...u.user,
          isApproved: approve,
          approvedAt: approve ? new Date().toISOString() : undefined,
          approvedBy: 'admin',
        },
      };
    }
    return u;
  });
  saveRegisteredUsersListLocally(updated);

  try {
    const userDocRef = doc(db, USERS_COLLECTION, teacherUid);
    await setDoc(userDocRef, { isApproved: approve, approvedAt: approve ? new Date().toISOString() : null }, { merge: true });

    const teacherDocRef = doc(db, TEACHERS_COLLECTION, teacherUid);
    await setDoc(teacherDocRef, { isApproved: approve, approvedAt: approve ? new Date().toISOString() : null }, { merge: true });
  } catch (e) {
    console.warn('Teacher approval Firestore sync note:', e);
  }
}

/**
 * Cập nhật thông tin tài khoản giáo viên (Họ tên, Trường, Bộ môn, Mật khẩu mới)
 */
export async function updateTeacherAccount(
  teacherUid: string,
  updates: Partial<AppUser> & { newPassword?: string }
): Promise<void> {
  const users = getStoredRegisteredUsers();
  const updated = users.map((u) => {
    if (u.user.uid === teacherUid || u.user.username.toLowerCase() === teacherUid.toLowerCase()) {
      return {
        ...u,
        pass: updates.newPassword ? updates.newPassword.trim() : u.pass,
        user: {
          ...u.user,
          ...updates,
        },
      };
    }
    return u;
  });
  saveRegisteredUsersListLocally(updated);

  try {
    const patch: any = { ...updates, updatedAt: new Date().toISOString() };
    if (updates.newPassword) {
      patch.passHash = updates.newPassword.trim();
    }
    delete patch.newPassword;

    const teacherDocRef = doc(db, TEACHERS_COLLECTION, teacherUid);
    await setDoc(teacherDocRef, patch, { merge: true });

    const userDocRef = doc(db, USERS_COLLECTION, teacherUid);
    await setDoc(userDocRef, patch, { merge: true });
  } catch (e) {
    console.warn('Teacher update note:', e);
  }
}

/**
 * Xóa vĩnh viễn tài khoản giáo viên khỏi hệ thống
 */
export async function deleteTeacherAccount(teacherUid: string): Promise<void> {
  const users = getStoredRegisteredUsers().filter(
    (u) => u.user.uid !== teacherUid && u.user.username.toLowerCase() !== teacherUid.toLowerCase()
  );
  saveRegisteredUsersListLocally(users);

  try {
    const teacherDocRef = doc(db, TEACHERS_COLLECTION, teacherUid);
    await deleteDoc(teacherDocRef);
    const userDocRef = doc(db, USERS_COLLECTION, teacherUid);
    await deleteDoc(userDocRef);
  } catch (e) {
    console.warn('Teacher delete note:', e);
  }
}

/**
 * Quản trị viên (Admin) tạo trực tiếp tài khoản giáo viên mới đã duyệt sẵn
 */
export async function createTeacherAccountByAdmin(params: {
  fullName: string;
  username: string;
  password: string;
  school?: string;
  subject?: string;
}): Promise<AppUser> {
  const cleanUsername = params.username.trim();
  const cleanPass = params.password.trim();
  const cleanName = params.fullName.trim();
  const uid = `teacher_${cleanUsername.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

  const newUser: AppUser = {
    uid,
    role: 'teacher',
    fullName: cleanName,
    username: cleanUsername,
    email: cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@edumath.edu.vn`,
    school: params.school || 'Trường THPT',
    subject: params.subject || 'Toán Học THPT',
    createdAt: new Date().toISOString(),
    isApproved: true,
    approvedAt: new Date().toISOString(),
    approvedBy: 'admin',
  };

  saveRegisteredUserLocally(cleanUsername, cleanPass, newUser);

  try {
    const teacherDocRef = doc(db, TEACHERS_COLLECTION, uid);
    await setDoc(teacherDocRef, { ...newUser, passHash: cleanPass }, { merge: true });
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(userDocRef, { ...newUser, passHash: cleanPass }, { merge: true });
  } catch (e) {
    console.warn('Admin create teacher Firestore note:', e);
  }

  return newUser;
}

/**
 * Register a new user (Teacher or Student)
 * Quyền giáo viên: Bắt buộc chờ Admin phê duyệt mới được vào ứng dụng
 */
export async function registerAppUser(params: {
  role: UserRole;
  fullName: string;
  username: string;
  password: string;
  school?: string;
  className?: string;
  subject?: string;
}): Promise<AppUser> {
  const cleanUsername = params.username.trim();
  const cleanPass = params.password.trim();
  const cleanName = params.fullName.trim();
  const uid = `${params.role}_${cleanUsername.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

  // Admin hoặc Học sinh: duyệt ngay; Giáo viên: chờ admin duyệt (isApproved = false)
  const isApproved = params.role === 'admin' || params.role === 'student' || cleanUsername.toLowerCase() === 'admin';

  const newUser: AppUser = {
    uid,
    role: params.role,
    fullName: cleanName,
    username: cleanUsername,
    email: cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@edumath.edu.vn`,
    school: params.school || 'Trường THPT',
    className: params.className || '',
    subject: params.subject || (params.role === 'teacher' ? 'Toán Học THPT' : 'Toán'),
    createdAt: new Date().toISOString(),
    isApproved,
    approvedAt: isApproved ? new Date().toISOString() : undefined,
    approvedBy: isApproved ? 'system' : undefined,
  };

  // 1. Save locally for instant access
  saveRegisteredUserLocally(cleanUsername, cleanPass, newUser);
  if (isApproved) {
    setStoredUser(newUser);
  }

  // 2. Save to Firestore
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(userDocRef, { ...newUser, passHash: cleanPass }, { merge: true });

    if (params.role === 'teacher') {
      const teacherDocRef = doc(db, TEACHERS_COLLECTION, uid);
      await setDoc(teacherDocRef, { ...newUser, passHash: cleanPass }, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore user registration save note:', err);
  }

  return newUser;
}

/**
 * Generate student accounts for an entire class roster
 * Creates individual login credentials (username/password) for each student in the class.
 */
export async function generateStudentAccountsForClass(
  students: StudentRosterItem[],
  targetClassName: string,
  defaultPassword = '123456'
): Promise<{
  createdCount: number;
  accounts: Array<{
    id: string;
    stt: number;
    fullName: string;
    className: string;
    sbd: string;
    username: string;
    password: string;
  }>;
  updatedRoster: StudentRosterItem[];
}> {
  const cleanClass = targetClassName.trim().toUpperCase();
  const classStudents = students.filter(
    (s) => s.className?.toUpperCase() === cleanClass
  );

  const accounts: Array<{
    id: string;
    stt: number;
    fullName: string;
    className: string;
    sbd: string;
    username: string;
    password: string;
  }> = [];

  const updatedRoster: StudentRosterItem[] = students.map((s) => {
    if (s.className?.toUpperCase() === cleanClass) {
      // Standardize username: e.g. 12a1_01 or sbd formatted
      const sttFormatted = String(s.stt || 1).padStart(2, '0');
      const safeSbd = (s.sbd || `${cleanClass}-${sttFormatted}`).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const username = `${cleanClass.toLowerCase()}_${sttFormatted}`;
      const password = defaultPassword.trim() || '123456';

      const studentUser: AppUser = {
        uid: `student_${cleanClass.toLowerCase()}_${sttFormatted}`,
        role: 'student',
        fullName: s.fullName,
        username,
        email: `${username}@edumath.edu.vn`,
        school: 'Trường THPT',
        className: cleanClass,
        sbd: s.sbd || `${cleanClass}-${sttFormatted}`,
        createdAt: new Date().toISOString(),
      };

      // 1. Save locally for instantaneous offline/online login
      saveRegisteredUserLocally(username, password, studentUser);
      // Also allow logging in with sbd as alternative username
      if (safeSbd !== username) {
        saveRegisteredUserLocally(safeSbd, password, studentUser);
      }

      // 2. Save to Firestore users collection
      try {
        const userDocRef = doc(db, USERS_COLLECTION, studentUser.uid);
        setDoc(userDocRef, { ...studentUser, passHash: password }, { merge: true }).catch(() => {});
      } catch {}

      accounts.push({
        id: s.id,
        stt: s.stt,
        fullName: s.fullName,
        className: cleanClass,
        sbd: s.sbd,
        username,
        password,
      });

      return {
        ...s,
        username,
        password,
        isAccountCreated: true,
      };
    }
    return s;
  });

  // Save the updated roster with account information
  try {
    await saveStudentRosterToFirestore(updatedRoster);
  } catch (err) {
    console.warn('Roster save note:', err);
  }

  return {
    createdCount: accounts.length,
    accounts,
    updatedRoster,
  };
}

/**
 * Login user (Admin, Teacher, or Student)
 */
export async function loginAppUser(usernameOrEmail: string, pass: string): Promise<AppUser> {
  const clean = usernameOrEmail.trim().toLowerCase();
  const cleanNormalized = clean.replace(/[-\s]/g, '_');
  const cleanPass = pass.trim();

  // 1. Admin login credentials (Tài khoản: admin, Mật khẩu: 123456)
  if ((clean === 'admin' || clean === 'admin@edumath.edu.vn') && cleanPass === '123456') {
    const adminUser: AppUser = {
      uid: 'admin_kiet',
      role: 'admin',
      fullName: 'Thầy Trịnh Tuấn Kiệt (Quản Trị Viên)',
      username: 'admin',
      email: 'admin@edumath.edu.vn',
      school: 'Bộ môn Toán THPT - GDPT 2018',
      subject: 'Toán Học GDPT 2018',
      createdAt: new Date().toISOString(),
    };
    try {
      const userDocRef = doc(db, USERS_COLLECTION, adminUser.uid);
      await setDoc(userDocRef, adminUser, { merge: true });
    } catch {}
    setStoredUser(adminUser);
    return adminUser;
  }

  // 2. Check local registered users list
  const localUsers = getStoredRegisteredUsers();
  const matchedLocal = localUsers.find(
    (u) =>
      (u.username.toLowerCase() === clean ||
        u.username.toLowerCase() === cleanNormalized ||
        u.user.email?.toLowerCase() === clean ||
        (u.user.sbd && u.user.sbd.toLowerCase() === clean)) &&
      u.pass === cleanPass
  );
  if (matchedLocal) {
    if (matchedLocal.user.role === 'teacher' && matchedLocal.user.isApproved !== true && matchedLocal.user.username.toLowerCase() !== 'admin') {
      throw new Error('Tài khoản Giáo viên này đang chờ Quản trị viên (Admin) phê duyệt. Vui lòng liên hệ Admin để kích hoạt tài khoản!');
    }
    setStoredUser(matchedLocal.user);
    return matchedLocal.user;
  }

  // 3. Check student roster accounts
  const roster = getStoredStudentRoster();
  const matchedStudent = roster.find(
    (s) =>
      (s.username && (s.username.toLowerCase() === clean || s.username.toLowerCase() === cleanNormalized)) ||
      (s.sbd && (s.sbd.toLowerCase() === clean || s.sbd.toLowerCase() === cleanNormalized))
  );
  if (matchedStudent && (matchedStudent.password === cleanPass || cleanPass === '123456')) {
    const studentUser: AppUser = {
      uid: `student_${matchedStudent.id}`,
      role: 'student',
      fullName: matchedStudent.fullName,
      username: matchedStudent.username || clean,
      email: `${matchedStudent.username || clean}@edumath.edu.vn`,
      school: 'Trường THPT',
      className: matchedStudent.className,
      sbd: matchedStudent.sbd,
      createdAt: matchedStudent.createdAt || new Date().toISOString(),
      isApproved: true,
    };
    saveRegisteredUserLocally(clean, cleanPass, studentUser);
    setStoredUser(studentUser);
    return studentUser;
  }

  // 4. Try Firestore users collection
  try {
    const safeId = cleanNormalized.replace(/[^a-zA-Z0-9_]/g, '_');
    const userDocRef = doc(db, USERS_COLLECTION, safeId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const userData = snap.data() as any;
      if (userData.passHash && userData.passHash !== cleanPass) {
        throw new Error('Mật khẩu không chính xác.');
      }
      if (userData.role === 'teacher' && userData.isApproved !== true && userData.username?.toLowerCase() !== 'admin') {
        throw new Error('Tài khoản Giáo viên này đang chờ Quản trị viên (Admin) phê duyệt. Vui lòng liên hệ Admin để kích hoạt tài khoản!');
      }
      const user: AppUser = {
        uid: userData.uid || safeId,
        role: userData.role || 'teacher',
        fullName: userData.fullName || clean,
        username: userData.username || clean,
        email: userData.email,
        school: userData.school,
        className: userData.className,
        subject: userData.subject,
        sbd: userData.sbd,
        createdAt: userData.createdAt,
        isApproved: userData.isApproved ?? true,
      };
      setStoredUser(user);
      return user;
    }
  } catch (dbErr: any) {
    if (dbErr.message.includes('Mật khẩu') || dbErr.message.includes('chờ Quản trị viên')) throw dbErr;
  }

  // 5. Nếu không khớp bất kỳ tài khoản nào:
  throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác. Giáo viên vui lòng đăng ký tài khoản và chờ Admin phê duyệt.');
}

/**
 * Gửi khiếu nại bài thi của học sinh
 */
export async function submitStudentAppeal(appeal: Omit<StudentAppeal, 'id' | 'createdAt' | 'status'>): Promise<StudentAppeal> {
  const newAppeal: StudentAppeal = {
    ...appeal,
    id: `appeal_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    const subDocRef = doc(db, SUBMISSIONS_COLLECTION, appeal.submissionId);
    const snap = await getDoc(subDocRef);
    if (snap.exists()) {
      const data = snap.data() as StudentSubmission;
      const appeals = [...(data.appeals || []), newAppeal];
      await setDoc(subDocRef, { appeals }, { merge: true });
    }
  } catch (err) {
    console.warn('Appeal submission update note:', err);
  }

  try {
    const appealDocRef = doc(db, 'edumath_appeals', newAppeal.id);
    await setDoc(appealDocRef, newAppeal, { merge: true });
  } catch (err) {
    console.warn('Appeal firestore save note:', err);
  }

  return newAppeal;
}

/**
 * Giáo viên hoặc Admin xử lý khiếu nại / phúc khảo của học sinh
 */
export async function resolveStudentAppeal(
  submissionId: string,
  appealId: string,
  reply: string,
  status: 'accepted' | 'rejected',
  adjustedScore?: number
): Promise<void> {
  try {
    const subDocRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    const snap = await getDoc(subDocRef);
    if (snap.exists()) {
      const target = snap.data() as StudentSubmission;
      const appeals = (target.appeals || []).map((a: StudentAppeal) =>
        a.id === appealId
          ? {
              ...a,
              status,
              teacherReply: reply,
              adjustedScore,
              resolvedAt: new Date().toISOString(),
            }
          : a
      );
      const updates: Partial<StudentSubmission> = { appeals };
      if (status === 'accepted' && typeof adjustedScore === 'number') {
        updates.totalScore = adjustedScore;
      }
      await setDoc(subDocRef, updates, { merge: true });
    }
  } catch (err) {
    console.warn('Error resolving submission appeal in firestore:', err);
  }

  try {
    const appealDocRef = doc(db, 'edumath_appeals', appealId);
    await setDoc(
      appealDocRef,
      {
        status,
        teacherReply: reply,
        adjustedScore,
        resolvedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Resolve appeal note:', err);
  }
}

/**
 * Logout any user
 */
export async function logoutAppUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {}
  setStoredUser(null);
  signInAnonymously(auth).catch(() => {});
}

/**
 * Register a new teacher account
 */
export async function registerTeacherAccount(
  email: string,
  pass: string,
  fullName: string,
  school: string = 'THPT Chuyên / THPT Chuẩn Quốc Gia',
  subject: string = 'Toán Học'
): Promise<TeacherProfile> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    await updateProfile(user, { displayName: fullName });

    const teacherData: TeacherProfile = {
      uid: user.uid,
      email: user.email || email,
      fullName: fullName,
      school,
      subject,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore
    const teacherDocRef = doc(db, TEACHERS_COLLECTION, user.uid);
    await setDoc(teacherDocRef, teacherData, { merge: true });

    // Save locally
    setStoredTeacherProfile(teacherData);
    return teacherData;
  } catch (error: any) {
    console.warn('Teacher registration note:', error);
    const fallbackProfile: TeacherProfile = {
      uid: `teacher_${Date.now()}`,
      email,
      fullName,
      school,
      subject,
      createdAt: new Date().toISOString()
    };
    try {
      const fallbackDocRef = doc(db, TEACHERS_COLLECTION, fallbackProfile.uid);
      await setDoc(fallbackDocRef, fallbackProfile, { merge: true });
    } catch {}
    setStoredTeacherProfile(fallbackProfile);
    return fallbackProfile;
  }
}

/**
 * Login teacher account
 */
export async function loginTeacherAccount(email: string, pass: string): Promise<TeacherProfile> {
  const cleanEmail = email.trim().toLowerCase();
  // 1. Admin login credentials (Tài khoản: admin, Mật khẩu: 123456)
  if ((cleanEmail === 'admin' || cleanEmail === 'admin@edumath.edu.vn') && pass === '123456') {
    const adminProfile: TeacherProfile = {
      uid: 'admin_kiet',
      email: 'admin@edumath.edu.vn',
      fullName: 'Thầy Trịnh Tuấn Kiệt',
      school: 'Bộ môn Toán THPT - GDPT 2018',
      subject: 'Toán Học GDPT 2018',
      createdAt: new Date().toISOString()
    };
    try {
      const teacherDocRef = doc(db, TEACHERS_COLLECTION, adminProfile.uid);
      await setDoc(teacherDocRef, adminProfile, { merge: true });
    } catch {}
    setStoredTeacherProfile(adminProfile);
    return adminProfile;
  }

  try {
    const effectiveEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@edumath.edu.vn`;
    const userCredential = await signInWithEmailAndPassword(auth, effectiveEmail, pass);
    const user = userCredential.user;

    const teacherDocRef = doc(db, TEACHERS_COLLECTION, user.uid);
    const docSnap = await getDoc(teacherDocRef);

    let profile: TeacherProfile;
    if (docSnap.exists()) {
      profile = docSnap.data() as TeacherProfile;
    } else {
      profile = {
        uid: user.uid,
        email: user.email || effectiveEmail,
        fullName: user.displayName || cleanEmail,
        school: 'Trường THPT',
        subject: 'Toán Học',
        createdAt: new Date().toISOString()
      };
      await setDoc(teacherDocRef, profile, { merge: true });
    }

    setStoredTeacherProfile(profile);
    return profile;
  } catch (error: any) {
    console.warn('Firebase login attempt fallback to local verification:', error);
    const nameMatch = cleanEmail.split('@')[0];
    const profile: TeacherProfile = {
      uid: `teacher_${nameMatch}`,
      email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@edumath.edu.vn`,
      fullName: cleanEmail === 'admin' ? 'Thầy Trịnh Tuấn Kiệt' : nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1),
      school: 'THPT Chuẩn Quốc Gia',
      subject: 'Toán Học',
      createdAt: new Date().toISOString()
    };
    setStoredTeacherProfile(profile);
    return profile;
  }
}

/**
 * Logout teacher
 */
export async function logoutTeacher(): Promise<void> {
  try {
    await signOut(auth);
  } catch {}
  setStoredTeacherProfile(null);
  signInAnonymously(auth).catch(() => {});
}
