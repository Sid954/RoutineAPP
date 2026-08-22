/**
 * Standalone seed script for Supabase faculty_members table.
 * 
 * Usage options:
 *   Option A (CLI Arguments - easiest on Windows PowerShell / cmd):
 *     node scripts/seed_faculty_supabase.js "https://xyz.supabase.co" "eyJhbGciOi..."
 * 
 *   Option B (PowerShell Environment Variables):
 *     $env:SUPABASE_URL="https://xyz.supabase.co"
 *     $env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
 *     node scripts/seed_faculty_supabase.js
 */
const { createClient } = require('@supabase/supabase-js');

// Support CLI arguments OR environment variables
const supabaseUrl = (process.argv[2] || process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-supabase-url') || supabaseServiceKey.includes('your-service-role-key')) {
  console.error('\n❌ ERROR: Missing or placeholder Supabase credentials.\n');
  console.error('Please run the script with your real Supabase URL and service_role key:');
  console.error('  node scripts/seed_faculty_supabase.js "<YOUR_SUPABASE_URL>" "<YOUR_SERVICE_ROLE_KEY>"\n');
  console.error('Example:');
  console.error('  node scripts/seed_faculty_supabase.js "https://abcdefghijklmno.supabase.co" "eyJhbGciOi..."\n');
  process.exit(1);
}

if (!supabaseUrl.startsWith('https://')) {
  console.error('\n❌ ERROR: SUPABASE_URL must start with https:// (e.g. https://xyz.supabase.co)\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const seedList = [
  {
    "teacher_code": "SMAI",
    "official_username": "asif_cse",
    "name": "Dr. Shahid Md. Asif Iqbal",
    "designation": "Professor · Department of Computer Science and Engineering · Associate Dean · Faculty Of Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/smai.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/asif_cse_1030600009.JPG",
    "status": "Active",
    "emails": [
      "asif.iqbal@puc.ac.bd",
      "asifcsep@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=asif_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "FSC",
    "official_username": "shirin_cse",
    "name": "Ms. Farhana Shirin Chowdhury",
    "designation": "Associate Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/fsc.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/shirin_cse_1031400005.JPG",
    "status": "Active",
    "emails": [
      "fshirin2007@gmail.com",
      "farhana_cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=shirin_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AKK",
    "official_username": "akram_cse",
    "name": "N.U.M Akramul Kabir Khan",
    "designation": "Associate Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/akk.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/akram_cse_akram.jpg",
    "status": "Active",
    "emails": [
      "numakramulkabirkhan7@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=akram_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "KD",
    "official_username": "kingshuk_cse",
    "name": "Kingshuk Dhar",
    "designation": "Assistant Professor & Administrative Coordinator · Department Of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/kd.JPG",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/kingshuk_cse_1031400108.JPG",
    "status": "Active",
    "emails": [
      "kingshuk2006@yahoo.com",
      "kingshuk2018@gmail.com",
      "kingshukdhar@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=kingshuk_cse",
    "social_links": {},
    "aliases": [
      "KLD"
    ],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "Ataur",
    "official_username": "ataur_cse",
    "name": "Md. Ataur Rahman",
    "designation": "Assistant Professor (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ataur.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/ataur_cse_MD ATAUR RAHAMAN.jpg",
    "status": "Study Leave",
    "emails": [
      "ataur_cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=ataur_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "TDM",
    "official_username": "tanni_cse",
    "name": "Ms. Tanni Dhoom",
    "designation": "Assistant Professor · Department of Computer Science and Engineering · Member, Eve Teasing Complain Committee",
    "department": "CSE",
    "photo": "src/assets/faculty/tdm.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/tanni_cse_DSC_3658.JPG",
    "status": "Active",
    "emails": [
      "tanni.cse0708@gmail.com",
      "tanni.dhoom@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=tanni_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AJT",
    "official_username": "asma_cse",
    "name": "Ms. Asma Joshita Trisha",
    "designation": "Assistant Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ajt.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/asma_cse_ASMA-JOSHITA-TRISHA.jpg",
    "status": "Active",
    "emails": [
      "joshita.cu@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=asma_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "ANIK_CSE",
    "official_username": "anik_cse",
    "name": "Anik Sen",
    "designation": "Assistant Professor (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/anik_cse.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/anik_cse_1041800195.JPG",
    "status": "Study Leave",
    "emails": [
      "aniksen.cuet09@gmail.com",
      "anik.sen@puc.ac.bd",
      "as5867@drexel.edu"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=anik_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "FAISAL_CSE",
    "official_username": "faisal_cse",
    "name": "Faisal Ahmed",
    "designation": "Assistant Professor (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/faisal_cse.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/faisal_cse_1041700179.JPG",
    "status": "Study Leave",
    "emails": [
      "faisalcsecubd@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=faisal_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "NAK",
    "official_username": "nazma_fbs",
    "name": "Nazma Akther",
    "designation": "Assistant Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/nak.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/nazma_fbs_Nazma.JPG",
    "status": "Active",
    "emails": [
      "nazmacse2013@gmail.com",
      "nazma.akther@puc.ac.bd",
      "nazma.akther@uts.edu.au"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=nazma_fbs",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "NJS",
    "official_username": "nusrat_cse",
    "name": "Ms. Nusrat Jahan Shirin",
    "designation": "Assistant Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/njs.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/nusrat_cse_1051500136.JPG",
    "status": "Active",
    "emails": [
      "nusratshirinpu@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=nusrat_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MH",
    "official_username": "hasan_cse",
    "name": "Mohammad Hasan",
    "designation": "Assistant Professor & Coordinator of M. Sc in CSE · Department of Computer Science and Engineering · Assistant Proctor",
    "department": "CSE",
    "photo": "src/assets/faculty/mh.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/hasan_cse_1041500137.JPG",
    "status": "Active",
    "emails": [
      "mehedi.cse@puc.ac.bd",
      "mehedih256@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=hasan_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "DHRUBA_CSE",
    "official_username": "dhruba_cse",
    "name": "Dhrubajyoti Das",
    "designation": "Assistant Professor (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/dhruba_cse.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/dhruba_cse_1041800196.JPG",
    "status": "Study Leave",
    "emails": [
      "dhrubajyoti1212@gmail.com",
      "dhruba_461@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=dhruba_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "ST",
    "official_username": "sabrina_cse",
    "name": "Ms. Sabrina Tarannum",
    "designation": "Assistant Professor · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/st.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/sabrina_cse_Ms. Sabrina Tarannum.jpg",
    "status": "Active",
    "emails": [
      "sabrina.tarannum@puc.ac.bd",
      "sabrincse@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=sabrina_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AIB",
    "official_username": "arif_cse",
    "name": "Md. Ariful Islam Bhuyan",
    "designation": "Lecturer (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/aib.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/arif_cse_1041700177.JPG",
    "status": "Study Leave",
    "emails": [
      "arif.ajtfs@yahoo.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=arif_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "SHREYASHI_CSE",
    "official_username": "Shreyashi_cse",
    "name": "Shreyashi Paul",
    "designation": "Lecturer (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/shreyashi_cse.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/shrayashi_cse_1042200212.JPG",
    "status": "Study Leave",
    "emails": [
      "shreyashicox@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=Shreyashi_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "KMAY",
    "official_username": "abrar_cse",
    "name": "Kazi Md. Abrar Yeaser",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/kmay.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/abrar_cse_1042200215.JPG",
    "status": "Active",
    "emails": [
      "abrar.yeaser@puc.ac.bd",
      "yeaser41@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=abrar_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AHK",
    "official_username": "adnan_cse",
    "name": "Adnan Hossain Khan",
    "designation": "Lecturer (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ahk.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/adnan_cse_1042200214.JPG",
    "status": "Study Leave",
    "emails": [
      "adnanhkhan@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=adnan_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "ADIBA_CSE",
    "official_username": "Adiba_cse",
    "name": "Adiba Ibnat Hossain",
    "designation": "Lecturer (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/adiba_cse.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/Adiba_cse_Adiba Ibnat Hossain.jpg",
    "status": "Study Leave",
    "emails": [
      "hossainadiba123@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=Adiba_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AD",
    "official_username": "Avisheak-cse",
    "name": "Avisheak Das",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ad.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/Avisheak-cse_Avisheak Das.jpg",
    "status": "Active",
    "emails": [
      "avisheak@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=Avisheak-cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MRRC",
    "official_username": "Rezaur_cse",
    "name": "Mohammed Rezaur Rahman Chowdhury",
    "designation": "Lecturer & Academic Coordinator of B.Sc in CSE · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mrrc.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/Rezaur_cse_Mohammad Rezaur Rahman Chowdhury.jpg",
    "status": "Active",
    "emails": [
      "mrrchy999@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=Rezaur_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MHN",
    "official_username": "mdhasan_cse",
    "name": "Md. Hasan",
    "designation": "Lecturer & Coordinator of Co-curricular activities · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mhn.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/mdhasan_cse_223. 1042200223.jpg",
    "status": "Active",
    "emails": [
      "mdhasan_cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=mdhasan_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "NR",
    "official_username": "noortaz_cse",
    "name": "Noortaz Rezoana",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/nr.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/noortaz_cse_Noortaz Rezoana.jpg",
    "status": "Active",
    "emails": [
      "noortaz6@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=noortaz_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MHE",
    "official_username": "mahmudul_hasan_cse",
    "name": "Mahmudul Hasan",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mhe.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/mahmudul_hasan_cse_mahmudul_hasan_cse.jpg",
    "status": "Active",
    "emails": [
      "mahmudulhasan154422@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=mahmudul_hasan_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "TMH",
    "official_username": "tamim_hossain",
    "name": "MD Tamim Hossain",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/tmh.png",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/tamim_hossain_MD Tamim Hossain.png",
    "status": "Active",
    "emails": [
      "tamim.hossain@puc.ac.bd",
      "thossain3333@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=tamim_hossain",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "JTC",
    "official_username": "jannattohfa",
    "name": "Jannat Tohfa Chowdhury",
    "designation": "Lecturer (Study Leave) · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/jtc.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/jannattohfa_Jannat Tohfa Chowdhury.jpeg",
    "status": "Study Leave",
    "emails": [
      "jannattohfa@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=jannattohfa",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AMS",
    "official_username": "asif_saad_cse",
    "name": "Asif Mohammed Saad",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ams.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/asif_saad_asif.jpg",
    "status": "Active",
    "emails": [
      "saad.cse@puc.ac.bd",
      "asifsaad730@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=asif_saad_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "NBH",
    "official_username": "nadim_cse",
    "name": "Nadim Bin Hossain",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/nbh.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/nadim_cse_nadim_cse.jpeg",
    "status": "Active",
    "emails": [
      "nadim.cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=nadim_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "TH",
    "official_username": "tashin_hossain_cse",
    "name": "Ms. Tashin Hossain",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/th.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/tashin_hossain_tashin.jpg",
    "status": "Active",
    "emails": [
      "tashin.hossain.cu@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=tashin_hossain_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "EAS",
    "official_username": "estiaksazid",
    "name": "Estiak Ahamed Sazid",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/eas.png",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/estiaksazid_Estiak Ahamed Sazid.png",
    "status": "Active",
    "emails": [
      "estiak.ahamed@puc.ac.bd",
      "estiaksazid@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=estiaksazid",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MTS",
    "official_username": "mdtoukirshah_cse",
    "name": "Md Toukir Shah",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mts.png",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/mdtoukirshah_cse_Md Toukir Shah.png",
    "status": "Active",
    "emails": [
      "toukir.shah@puc.ac.bd",
      "mdtoukirshah122@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=mdtoukirshah_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "RA",
    "official_username": "roshni",
    "name": "Rowshon Akter",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/ra.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/roshni_Rowshon Akter.jpg",
    "status": "Active",
    "emails": [
      "roshni.cse18@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=roshni",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "CFK",
    "official_username": "fariha_cse",
    "name": "Chowdhury Fariha Kamrul",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/cfk.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/fariha_cse_Chowdhury_Fariha_Kamrul_PUC_CSE.jpeg",
    "status": "Active",
    "emails": [
      "far400305@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=fariha_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MRI",
    "official_username": "raisulislam_cse",
    "name": "Md. Raisul Islam",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mri.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/raisulislam_cse_1042500278 Md. Raisul Islam.jpeg",
    "status": "Active",
    "emails": [
      "mdraisulislam2040@mail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=raisulislam_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "MFF",
    "official_username": "fahim_csecu_gt",
    "name": "Mohammd Fahim Foisal",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/mff.png",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/fahim_csecu_gt_1042500279 Mohammad Fahim Foisal.png",
    "status": "Active",
    "emails": [
      "fahim.csecu@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=fahim_csecu_gt",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "THA",
    "official_username": "tanvirhassan_cse",
    "name": "Tanvir Hassan Ananta",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/tha.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/tanvirhassan_cse_1042500280 Tanvir Hassan Ananta.jpeg",
    "status": "Active",
    "emails": [
      "tanvirhassan@iut-dhaka.edu"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=tanvirhassan_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "TMC",
    "official_username": "tahiatmahabub_cse",
    "name": "Tahiat Mahabub Chowdhury",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/tmc.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/tahiatmahabub_cse_1042500281 Tahiat Mahabub Chowdhury.jpeg",
    "status": "Active",
    "emails": [
      "tahiatmahabub355@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=tahiatmahabub_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "YR",
    "official_username": "yakinur_cse",
    "name": "Yakinur Rahman",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/yr.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/yakinur_cse_1042500282 Yakinur Rahman.jpeg",
    "status": "Active",
    "emails": [
      "yakinur_cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=yakinur_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "KMN",
    "official_username": "kafayet_cse",
    "name": "Kafayet Monoar Nahin",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/kmn.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/kafayet_cse_1042500283 Kafayet Monoar Nahin.jpg",
    "status": "Active",
    "emails": [
      "kafayetccs22@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=kafayet_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "RM",
    "official_username": "rashed_cse",
    "name": "Rashed Miah",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/rm.jpg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/rashed_cse_1042500284 Rashed Mia.jpeg",
    "status": "Active",
    "emails": [
      "rashed_cse@puc.ac.bd"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=rashed_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "WMN",
    "official_username": "wong_cse",
    "name": "Wong May Nu",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/wmn.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/wong_cse_1042600286 Wong May Nu.jpeg",
    "status": "Active",
    "emails": [
      "wong.ngyo@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=wong_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  },
  {
    "teacher_code": "AU",
    "official_username": "afsar_cse",
    "name": "Afsar Uddin",
    "designation": "Lecturer · Department of Computer Science and Engineering",
    "department": "CSE",
    "photo": "src/assets/faculty/au.jpeg",
    "source_photo_url": "https://admin.puc.ac.bd/ProfilePictures/afsar_cse_afsar_PUC_CSE.jpeg",
    "status": "Active",
    "emails": [
      "afsarmohammadi52@gmail.com"
    ],
    "phone": "",
    "profile_url": "https://cse.puc.ac.bd/Home/Profile?userName=afsar_cse",
    "social_links": {},
    "aliases": [],
    "source": "ground_truth_seed"
  }
];

async function seed() {
  console.log('\n======================================================');
  console.log('🚀 Premier University - Faculty Directory Seeder');
  console.log(`Target Supabase: ${supabaseUrl}`);
  console.log(`Total Members to Seed: ${seedList.length}`);
  console.log('======================================================\n');

  // Pre-flight check: verify database connection and table existence
  console.log('Performing pre-flight connection test...');
  const { error: pingError } = await supabase.from('faculty_members').select('id').limit(1);

  if (pingError) {
    console.error('\n❌ PRE-FLIGHT TEST FAILED!');
    console.error(`Message: ${pingError.message}`);
    if (pingError.details) console.error(`Details: ${pingError.details}`);
    if (pingError.hint) console.error(`Hint: ${pingError.hint}`);
    if (pingError.code) console.error(`Code: ${pingError.code}`);
    if (pingError.cause) console.error(`Cause: ${pingError.cause}`);
    
    if (pingError.message?.includes('fetch failed')) {
      console.error('\n👉 Diagnostic: Node could not connect to the Supabase URL. Please verify your internet connection and ensure the URL is typed correctly.');
    } else if (pingError.message?.includes('relation "faculty_members" does not exist') || pingError.code === '42P01') {
      console.error('\n👉 Diagnostic: The "faculty_members" table does not exist in Supabase yet. Please run supabase_faculty_members.sql in your Supabase SQL Editor first.');
    } else if (pingError.message?.includes('JWT') || pingError.code === '401' || pingError.message?.includes('apikey')) {
      console.error('\n👉 Diagnostic: Authentication failed. Please ensure you are passing the "service_role" secret key (not the anon key).');
    }
    process.exit(1);
  }

  console.log('✅ Connection test successful! Seeding faculty members...\n');
  let successCount = 0;
  let failCount = 0;

  for (const item of seedList) {
    const { data, error } = await supabase
      .from('faculty_members')
      .upsert(item, { onConflict: 'teacher_code' })
      .select();

    if (error) {
      failCount++;
      console.error(`❌ Failed to seed ${item.teacher_code} (${item.name}): ${error.message}`);
      if (error.details) console.error(`   Details: ${error.details}`);
      if (error.hint) console.error(`   Hint: ${error.hint}`);
    } else {
      successCount++;
      console.log(`✅ [${successCount}/42] Seeded ${item.teacher_code}: ${item.name} (${item.emails.length} emails, photo: ${item.photo})`);
    }
  }

  console.log('\n======================================================');
  console.log(`🎉 Finished! Successfully seeded ${successCount} of ${seedList.length} members (${failCount} errors).`);
  console.log('======================================================\n');
}

seed().catch(err => {
  console.error('\n❌ Fatal script error:', err);
  if (err.cause) console.error('Underlying cause:', err.cause);
  process.exit(1);
});
