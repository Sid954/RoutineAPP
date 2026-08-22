/**
 * Standalone seed script for Supabase faculty_members table.
 * Usage: node scripts/seed_faculty_supabase.js
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('Run: SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/seed_faculty_supabase.js');
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/asif_cse_1030600009.JPG",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/faisal_cse_1041700179.JPG",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/abrar_cse_1042200215.JPG",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/adnan_cse_1042200214.JPG",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/Avisheak-cse_Avisheak Das.jpg",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/mdtoukirshah_cse_Md Toukir Shah.png",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/tanvirhassan_cse_1042500280 Tanvir Hassan Ananta.jpeg",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/kafayet_cse_1042500283 Kafayet Monoar Nahin.jpg",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/rashed_cse_1042500284 Rashed Mia.jpeg",
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
  console.log('Seeding 42 verified faculty members to Supabase faculty_members table...');
  let successCount = 0;

  for (const item of seedList) {
    const { data, error } = await supabase
      .from('faculty_members')
      .upsert(item, { onConflict: 'teacher_code' })
      .select();

    if (error) {
      console.error(`Failed to seed ${item.teacher_code} (${item.name}):`, error.message);
    } else {
      successCount++;
      console.log(`✅ [${successCount}/42] Seeded ${item.teacher_code}: ${item.name} (${item.emails.length} email(s))`);
    }
  }

  console.log(`Finished! Successfully seeded ${successCount} of ${seedList.length} faculty members.`);
}

seed().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
