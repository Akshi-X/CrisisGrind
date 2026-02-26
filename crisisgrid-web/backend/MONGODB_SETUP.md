# MongoDB setup for CrisisGrid backend

The error `connect ECONNREFUSED ::1:27017` means the app cannot reach MongoDB. Use one of the options below.

---

## Option 1: MongoDB Atlas (recommended, no local install)

1. Go to **https://cloud.mongodb.com** and sign up (free).
2. Create a **free cluster** (M0).
3. Under **Database Access** → Add Database User: set username and password (remember the password).
4. Under **Network Access** → Add IP Address → **Allow Access from Anywhere** (or add your IP).
5. In **Database** → **Connect** → **Connect your application** → copy the connection string. It looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `USERNAME` and `PASSWORD` with your DB user. Add the database name:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/crisisgrid?retryWrites=true&w=majority
   ```
7. In the backend folder, open **`.env`** and set:
   ```
   MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/crisisgrid?retryWrites=true&w=majority
   ```
8. Restart the backend: `npm run dev`.

---

## Option 2: MongoDB installed locally (Windows)

1. **Install MongoDB Community**  
   https://www.mongodb.com/try/download/community  
   Choose Windows, MSI, and install (include “Install MongoDB as a Service” if offered).

2. **Start the service**
   - Open **Services** (Win + R → `services.msc`).
   - Find **MongoDB Server** → right‑click → **Start**.
   - Or in an **Admin** PowerShell:
     ```powershell
     net start MongoDB
     ```

3. Your `.env` can stay:
   ```
   MONGO_URI=mongodb://localhost:27017/crisisgrid
   ```

4. Restart the backend: `npm run dev`.

---

If you use **Option 1 (Atlas)**, update the `MONGO_URI` line in `.env` with your Atlas connection string (and do not commit `.env` or share the password).
