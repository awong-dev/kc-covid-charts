import Head from 'next/head'
import DataTable from '../components/data-table'
import TimeSeries from '../components/time-series'
import styles from '../styles/Home.module.css'

export default function Home({covidData}) {
  return (
    <div className={styles.container}>
      <Head>
        <title>King County Covid Charts</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          King County Covid Charts
        </h1>

        <p className={styles.description}>
          Provides a slightly different view of the data on 
          <a href="https://www.kingcounty.gov/depts/health/covid-19/data/daily-summary.aspx">King County Daily Outbreak Summary.</a>
        </p>

        <div className={styles.grid}>
          <TimeSeries locationData={covidData['HRA']} />
          <DataTable locationType="HRA" locationData={covidData['HRA']} />
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <img src="/vercel.svg" alt="Vercel Logo" className={styles.logo} />
        </a>
      </footer>
    </div>
  )
}

export async function getStaticProps() {
  const res = await fetch('https://firebasestorage.googleapis.com/v0/b/kc-covid-chart.appspot.com/o/processed%2Fdata.json?alt=media&token=18ebf1ec-4143-4272-9b3a-4bee6c62793e');
  const covidData = await res.json();

  return {
    props: {
      covidData,
    },
    revalidate: 1, // In seconds
  }
}
