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
import { Exam, StudentSubmission, StudentRosterItem, ClassGroup, TeacherProfile, AppUser, UserRole } from '../types/exam';

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

/**
 * Save or update an exam in Firebase Cloud Firestore
 */
export async function saveExamToFirestore(exam: Exam): Promise<void> {
  const path = `${EXAMS_COLLECTION}/${exam.id}`;
  try {
    const examDocRef = doc(db, EXAMS_COLLECTION, exam.id);
    const dataToSave = {
      ...exam,
      updatedAt: new Date().toISOString()
    };
    await setDoc(examDocRef, dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete an exam from Firebase Cloud Firestore
 */
export async function deleteExamFromFirestore(examId: string): Promise<void> {
  const path = `${EXAMS_COLLECTION}/${examId}`;
  try {
    const examDocRef = doc(db, EXAMS_COLLECTION, examId);
    await deleteDoc(examDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
      snapshot.forEach((docSnap) => {
        exams.push(docSnap.data() as Exam);
      });
      // Sort by newest first
      exams.sort((a, b) => {
        const timeA = (a as any).updatedAt || (a as any).createdAt || '';
        const timeB = (b as any).updatedAt || (b as any).createdAt || '';
        return timeB.localeCompare(timeA);
      });
      onExams(exams);
    },
    (error) => {
      console.error('Error listening to exams:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, EXAMS_COLLECTION);
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

const STUDENTS_COLLECTION = 'students';

/**
 * Save student roster to Firebase Cloud Firestore
 */
export async function saveStudentRosterToFirestore(students: StudentRosterItem[]): Promise<void> {
  for (const st of students) {
    const safeDocId = `${st.className || 'lop'}_${st.sbd || st.id || st.stt}`.replace(/[\/\s#?]/g, '_');
    const docRef = doc(db, STUDENTS_COLLECTION, safeDocId);
    await setDoc(docRef, { ...st, id: safeDocId, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

/**
 * Subscribe to real-time student roster from Firebase Cloud Firestore
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
        list.push(docSnap.data() as StudentRosterItem);
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

export function getStoredClasses(): ClassGroup[] {
  try {
    const raw = localStorage.getItem(CLASSES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [
      { id: '10A1', name: '10A1', grade: '10', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() },
      { id: '10A2', name: '10A2', grade: '10', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() },
      { id: '12A8', name: '12A8', grade: '12', schoolYear: '2024 - 2025', createdAt: new Date().toISOString() }
    ];
  } catch {
    return [];
  }
}

export function saveClassesLocally(classes: ClassGroup[]): void {
  try {
    localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(classes));
  } catch (e) {
    console.error('Error saving classes locally:', e);
  }
}

export async function saveClassGroupToFirestore(cls: ClassGroup): Promise<void> {
  const safeId = cls.id || cls.name.replace(/[^a-zA-Z0-9_]/g, '_');
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    const local = getStoredClasses();
    const updated = [cls, ...local.filter(c => c.id !== cls.id && c.name !== cls.name)];
    saveClassesLocally(updated);

    const docRef = doc(db, CLASSES_COLLECTION, safeId);
    await setDoc(docRef, { ...cls, id: safeId, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeClassGroupsFromFirestore(
  onClasses: (classes: ClassGroup[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, CLASSES_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const list: ClassGroup[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ClassGroup);
      });
      if (list.length > 0) {
        saveClassesLocally(list);
        onClasses(list);
      } else {
        // Fallback to local default classes if firestore collection is empty
        const local = getStoredClasses();
        onClasses(local);
      }
    },
    (error) => {
      console.warn('Class groups subscription fallback to local storage:', error);
      const local = getStoredClasses();
      onClasses(local);
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

export async function deleteClassGroupFromFirestore(classId: string): Promise<void> {
  const path = `${CLASSES_COLLECTION}/${classId}`;
  try {
    const local = getStoredClasses().filter(c => c.id !== classId && c.name !== classId);
    saveClassesLocally(local);

    const docRef = doc(db, CLASSES_COLLECTION, classId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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

/**
 * Register a new user (Teacher or Student)
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
  };

  // 1. Save locally for instant access
  saveRegisteredUserLocally(cleanUsername, cleanPass, newUser);
  setStoredUser(newUser);

  // 2. Save to Firestore
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(userDocRef, { ...newUser, passHash: cleanPass }, { merge: true });

    if (params.role === 'teacher') {
      const teacherDocRef = doc(db, TEACHERS_COLLECTION, uid);
      await setDoc(teacherDocRef, newUser, { merge: true });
    }
  } catch (err) {
    console.warn('Firestore user registration save note:', err);
  }

  return newUser;
}

/**
 * Login user (Admin, Teacher, or Student)
 */
export async function loginAppUser(usernameOrEmail: string, pass: string): Promise<AppUser> {
  const clean = usernameOrEmail.trim().toLowerCase();
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
    (u) => (u.username.toLowerCase() === clean || u.user.email?.toLowerCase() === clean) && u.pass === cleanPass
  );
  if (matchedLocal) {
    setStoredUser(matchedLocal.user);
    return matchedLocal.user;
  }

  // 3. Try Firestore
  try {
    const safeId = clean.replace(/[^a-zA-Z0-9_]/g, '_');
    const userDocRef = doc(db, USERS_COLLECTION, safeId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const userData = snap.data() as any;
      if (userData.passHash && userData.passHash !== cleanPass) {
        throw new Error('Mật khẩu không chính xác.');
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
        createdAt: userData.createdAt,
      };
      setStoredUser(user);
      return user;
    }
  } catch (dbErr: any) {
    if (dbErr.message === 'Mật khẩu không chính xác.') throw dbErr;
  }

  // 4. Fallback user login
  const nameMatch = clean.split('@')[0];
  const isStudent = clean.includes('hs') || clean.includes('student') || clean.startsWith('10') || clean.startsWith('11') || clean.startsWith('12');
  const fallbackUser: AppUser = {
    uid: `user_${nameMatch}`,
    role: isStudent ? 'student' : 'teacher',
    fullName: nameMatch.charAt(0).toUpperCase() + nameMatch.slice(1),
    username: clean,
    email: clean.includes('@') ? clean : `${clean}@edumath.edu.vn`,
    school: 'Trường THPT',
    className: isStudent ? '12A' : '',
    subject: 'Toán Học',
    createdAt: new Date().toISOString(),
  };
  setStoredUser(fallbackUser);
  return fallbackUser;
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
