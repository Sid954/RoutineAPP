/**
 * Standalone seed script for Supabase faculty_members table.
 * Usage: node scripts/seed_faculty_supabase.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
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
      "asif_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/shirin_cse_1031400005.JPG",
    "status": "Active",
    "emails": [
      "shirin_cse@puc.ac.bd",
      "farhana.shirin@gmail.com"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/akram_cse_akram.jpg",
    "status": "Active",
    "emails": [
      "akram_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/kingshuk_cse_1031400108.JPG",
    "status": "Active",
    "emails": [
      "kingshuk_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/ataur_cse_MD ATAUR RAHAMAN.jpg",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/tanni_cse_DSC_3658.JPG",
    "status": "Active",
    "emails": [
      "tanni_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/asma_cse_ASMA-JOSHITA-TRISHA.jpg",
    "status": "Active",
    "emails": [
      "asma_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/anik_cse_1041800195.JPG",
    "status": "Study Leave",
    "emails": [
      "anik_cse@puc.ac.bd"
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
      "faisal_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/nazma_fbs_Nazma.JPG",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/nusrat_cse_1051500136.JPG",
    "status": "Active",
    "emails": [
      "nusrat_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/hasan_cse_1041500137.JPG",
    "status": "Active",
    "emails": [
      "hasan_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/dhruba_cse_1041800196.JPG",
    "status": "Study Leave",
    "emails": [
      "dhruba_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/sabrina_cse_Ms. Sabrina Tarannum.jpg",
    "status": "Active",
    "emails": [
      "sabrina_cse@puc.ac.bd",
      "sabrinatarannum00@gmail.com"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/arif_cse_1041700177.JPG",
    "status": "Study Leave",
    "emails": [
      "arif_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/shrayashi_cse_1042200212.JPG",
    "status": "Study Leave",
    "emails": [
      "shreyashi_cse@puc.ac.bd"
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
      "abrar_cse@puc.ac.bd"
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
      "adnan_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/Adiba_cse_Adiba Ibnat Hossain.jpg",
    "status": "Study Leave",
    "emails": [
      "adiba_cse@puc.ac.bd"
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
      "avisheak_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/Rezaur_cse_Mohammad Rezaur Rahman Chowdhury.jpg",
    "status": "Active",
    "emails": [
      "rezaur_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/mdhasan_cse_223. 1042200223.jpg",
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/noortaz_cse_Noortaz Rezoana.jpg",
    "status": "Active",
    "emails": [
      "noortaz_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/mahmudul_hasan_cse_mahmudul_hasan_cse.jpg",
    "status": "Active",
    "emails": [
      "mahmudul_hasan_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/tamim_hossain_MD Tamim Hossain.png",
    "status": "Active",
    "emails": [
      "tamim_hossain@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/jannattohfa_Jannat Tohfa Chowdhury.jpeg",
    "status": "Study Leave",
    "emails": [
      "jannattohfa@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/asif_saad_asif.jpg",
    "status": "Active",
    "emails": [
      "asif_saad_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/nadim_cse_nadim_cse.jpeg",
    "status": "Active",
    "emails": [
      "nadim_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/tashin_hossain_tashin.jpg",
    "status": "Active",
    "emails": [
      "tashin_hossain_cse@puc.ac.bd",
      "tashin.hossain@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/estiaksazid_Estiak Ahamed Sazid.png",
    "status": "Active",
    "emails": [
      "estiaksazid@puc.ac.bd"
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
      "mdtoukirshah_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/roshni_Rowshon Akter.jpg",
    "status": "Active",
    "emails": [
      "roshni@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/fariha_cse_Chowdhury_Fariha_Kamrul_PUC_CSE.jpeg",
    "status": "Active",
    "emails": [
      "fariha_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/raisulislam_cse_1042500278 Md. Raisul Islam.jpeg",
    "status": "Active",
    "emails": [
      "raisulislam_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/fahim_csecu_gt_1042500279 Mohammad Fahim Foisal.png",
    "status": "Active",
    "emails": [
      "fahim_csecu_gt@puc.ac.bd"
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
      "tanvirhassan_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/tahiatmahabub_cse_1042500281 Tahiat Mahabub Chowdhury.jpeg",
    "status": "Active",
    "emails": [
      "tahiatmahabub_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/yakinur_cse_1042500282 Yakinur Rahman.jpeg",
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
      "kafayet_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/wong_cse_1042600286 Wong May Nu.jpeg",
    "status": "Active",
    "emails": [
      "wong_cse@puc.ac.bd"
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
    "photo": "https://admin.puc.ac.bd/ProfilePictures/afsar_cse_afsar_PUC_CSE.jpeg",
    "status": "Active",
    "emails": [
      "afsar_cse@puc.ac.bd"
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
      console.log(`✅ [${successCount}/42] Seeded ${item.teacher_code}: ${item.name}`);
    }
  }

  console.log(`Finished! Successfully seeded ${successCount} of ${seedList.length} faculty members.`);
}

seed().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
