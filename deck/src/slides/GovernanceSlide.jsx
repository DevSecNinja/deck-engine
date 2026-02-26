import Slide from '../components/Slide'
import BottomBar from '../components/BottomBar'
import styles from './GovernanceSlide.module.css'

const roles = [
  { role: 'Program Owner', assignee: 'Leandro Lopez', badge: 'Leandro Lopez', badgeClass: 'owner' },
  { role: 'GitHub Program Sponsor', assignee: 'TBD', badge: 'TBD', badgeClass: 'tbd' },
  { role: 'CSU Program Sponsor', assignee: 'TBD', badge: 'TBD', badgeClass: 'tbd' },
  { role: 'GitHub Speaker Pool Lead', assignee: 'TBD', badge: 'TBD', badgeClass: 'tbd' },
  { role: 'Microsoft Speaker Pool Lead', assignee: 'TBD', badge: 'TBD', badgeClass: 'tbd' },
  {
    role: 'Industry Pool Lead',
    assignee: 'tags',
    tags: [
      { label: 'FSI', cls: 'fsi' },
      { label: 'Retail', cls: 'retail' },
      { label: 'Manufacturing', cls: 'mfg' },
      { label: 'Public', cls: 'public' },
    ],
  },
]

export default function GovernanceSlide() {
  return (
    <Slide index={7} className={styles.governance}>
      <div className="accent-bar" />
      <div className="grid-dots" style={{ right: 40, top: 100 }} />

      <div className="content-frame content-gutter">
        <div className={styles.header}>
          <h2>Governance</h2>
        </div>
        <p className={styles.subtitle}>A lightweight governance with clear owners ensures a smooth and scalable program execution.</p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r, i) => (
                <tr key={i}>
                  <td>{r.role}</td>
                  <td>
                    {r.tags ? (
                      <div className={styles.tagRow}>
                        {r.tags.map((t) => (
                          <span key={t.cls} className={`${styles.tag} ${styles[`tag${t.cls}`]}`}>{t.label}</span>
                        ))}
                      </div>
                    ) : (
                      <span className={`${styles.badge} ${styles[r.badgeClass]}`}>{r.badge}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BottomBar />
    </Slide>
  )
}
